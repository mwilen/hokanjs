(function(){
    const Hokan = function(keys){

        const self = this;

        const stringRegExp = /{{(.*?)}}/g;
        const ignoredNodes = /(html|body|script|style|meta|head|link)/gi;
        let placeholders = {};
        let prevKeys = {};
        let tempPrevKeys = {};
        let listeners = [];
        let iterables = [];
        
        this.keys = keys || {};

        const state = {
            updateQueue: [],
            changed: false,
            setState: function(obj){
                const key = Object.keys(obj)[0];
                this.updateQueue.push(placeholders[key])
                console.log(this.updateQueue)
            }
        }
        
        this.onChange = function(cb) {
            var returnProps = {...this.keys};
            for(var i in listeners){
                listeners[i](tempPrevKeys, returnProps);
            }
            typeof cb === 'function' && listeners.push(cb);
        }
        
        this.set = function(obj) {
            this.keys = {...this.keys, ...obj};
        }

        Object.freeze(this);

        function parseDOM() {
            if(!document.body)
                return;
            document.body.childNodes.forEach((elem) => {
                if(elem.nodeType === 3 || (elem.tagName && !elem.tagName.match(ignoredNodes))){
                    if(elem.attributes){
                        for(let i = 0; i < elem.attributes.length; i++){
                            let attr = elem.attributes[i];
                            if(findPlaceholders(attr.value)){
                                findPlaceholders(attr.value).forEach((match) => addPlaceholderElement(elem, match, Type.Attribute))
                            }
                            if(attr.name === 'hk-model'){
                                elem.addEventListener('keyup', function(){
                                    self.keys[attr.value] = this.value;
                                })
                                elem.addEventListener('keydown', function(){
                                    self.keys[attr.value] = this.value;
                                })
                                if(self.keys[attr.value]){
                                    elem.value = self.keys[attr.value];
                                }
                                listeners.push(function(o, n){
                                    elem.value = self.keys[attr.value];
                                })
                            }
                            if(attr.name === 'hk-for'){
                                iterables.push({
                                    variable: attr.value.split(' ')[1],
                                    iterable: attr.value.split(' ')[3],
                                    original: elem.cloneNode(true),
                                    clone: elem,
                                    elems: [elem],
                                    wasChanged: true
                                })
                                addPlaceholderElement(elem, attr.value.split(' ')[3], Type.Iterable)
                            }
                        }
                    }
                    const elemVal = elem.textContent || elem.innerText;
                    if(findPlaceholders(elemVal).length && !isIterable(elem)){
                        findPlaceholders(elemVal).forEach((match) => addPlaceholderElement(elem, match, Type.Text))
                    }
                }
            })
        }
        
        function addPlaceholderElement(element, property, type){
            let prop = property.replace(/[${}]/g, '');
            if(!placeholders[prop]){
                placeholders[prop] = new Property(prop);
            }
            placeholders[prop].elements.push({
                original: element.cloneNode(true),
                clone: element,
                type: type,
                elems: [element]
            });
        }

        function updateElements(queueElement){
            
            // for(let i in state.updateQueue){
            //     let placeholder = state.updateQueue[i];
            //     if(placeholder.wasChanged){
            //         placeholder.elements.forEach((element) => resetElementState(element));
            //     }
            // }

            console.log(queueElement)
            let placeholder = queueElement;
            let prop = self.keys[placeholder.key];
            placeholder.elements.forEach((element) => {
                resetElementState(element)
                if(element.type === Type.Text){
                    if(element.clone.nodeType === 3){
                        element.clone.textContent = placeholderToValue(
                            element.clone.textContent, 
                            placeholder.key, 
                            prop
                        );
                    }
                    else {
                        element.clone.innerHTML = placeholderToValue(
                            element.clone.innerText, 
                            placeholder.key, 
                            prop
                        );
                    }
                }
                if(element.type === Type.Attribute){
                    for(let j = 0; j < element.clone.attributes.length; j++){
                        element.clone.attributes[j].value = placeholderToValue(
                            element.clone.attributes[j].value, 
                            placeholder.key, 
                            prop
                        );
                    }
                }
                if(element.type === Type.Iterable){
                    
                }
            })
            state.updateQueue.shift();
            
        }

        function updateIterables(){
            iterables.forEach((iterable) => {
                if(!iterable.wasChanged){
                    return;
                }
                
                if(!iterable.variable || !iterable.iterable){
                    throw new Error('Invalid iterator expression. Expected e.g "let i of array"')
                }

                let keyValues = self.keys[iterable.iterable];

                // Reset the iterable
                iterable.clone.innerText = iterable.original.innerText;
                for(var i = iterable.elems.length - 1 ; i > 0; i--){
                    iterable.elems[i].parentNode.removeChild(iterable.elems[i]);
                }
                iterable.elems = [iterable.elems[0]];

                const stringPlaceholders = findPlaceholders(iterable.clone.innerText);
                for(var i = 0; i < keyValues.length - 1; i++){
                    let elem = iterable.original.cloneNode(true);
                    iterable.clone.parentNode.insertBefore(elem, iterable.elems[iterable.elems.length-1].nextSibling)
                    iterable.elems.push(elem)
                }

                for(var i = 0; i < keyValues.length; i++){
                    for(let p in stringPlaceholders){
                        const placeholder = stringPlaceholders[p].replace(/[${}]/g, '')
                        let key = i;
                        if(isObject(keyValues[i])){
                            if(placeholder.indexOf('.') != -1){
                                key = placeholder.split('.')[1];
                                iterable.elems[i].innerHTML = placeholderToValue(iterable.elems[i].innerText, placeholder, keyValues[i][key]);
                            }
                            else {
                                iterable.elems[i].innerHTML = placeholderToValue(iterable.elems[i].innerText, placeholder, keyValues[i]);
                            }
                        }
                        else {
                            if(placeholder.indexOf('.') === -1){
                                iterable.elems[i].innerHTML = placeholderToValue(iterable.elems[i].innerText, placeholder, keyValues[key]);
                            }
                            else {
                                iterable.elems[i].innerHTML = placeholderToValue(iterable.elems[i].innerText, placeholder, undefined);
                            }
                        }
                    }
                }
                iterable.wasChanged = false;
            })
        }

        function resetElementState(element) {
            if(element.type === Type.Text){
                if(element.clone.nodeType === 3){
                    element.clone.textContent = element.original.textContent;
                }
                else {
                    element.clone.innerText = element.original.innerText;
                }
            }
            if(element.type === Type.Attribute){
                for(let i = 0; i < element.original.attributes.length; i++){
                    element.clone.attributes[i].value = element.original.attributes[i].value
                }
            }
            if(element.type === Type.Iterable){
                // Do stuff
            }
        }

        function findPlaceholders(val){
            return val.match(stringRegExp) || [];
        }

        function isIterable(elem){
            return !!(elem.getAttribute && elem.getAttribute('hk-for'))
        }

        function isObject(obj){
            return Object.getPrototypeOf(obj) === Object.prototype
        }

        function updateDOM(){
            for(let i in state.updateQueue){
                updateElements(state.updateQueue[i]);
            }
            updateIterables();
        }

        function placeholderToValue(text, placeholder, value){
            return text.replace('{{'+ placeholder + '}}', value)
        }

        (function changeDetector() {

            const raf = (function(){
                return window.requestAnimationFrame 
                || window.webkitRequestAnimationFrame 
                || window.mozRequestAnimationFrame 
                || window.oRequestAnimationFrame 
                || window.msRequestAnimationFrame
                || function(cb){setTimeout(cb,1000/60)};
            })();

            (function timer(){
                for(let i in self.keys){
                    tempPrevKeys[i] = prevKeys[i];
                    if(self.keys[i] !== prevKeys[i]){
                        prevKeys[i] = self.keys[i];
                        const obj = {}
                        obj[i] = self.keys[i]
                        state.setState(obj);
                        for(let j in iterables){
                            if(iterables[j].iterable === i){
                                iterables[j].wasChanged = true;
                            }
                        }
                        // Update the DOM
                        updateDOM();
                    }
                }
                // If a property/value was changed
                if(state.updateQueue.length){
                    // Notify possible listeners that a change occurred
                    self.onChange();
                    tempPrevKeys = {};
                }
                raf(timer);
            })();

        })();

        if(document.readyState === 'complete'){
            parseDOM();
        }

        window.addEventListener('DOMContentLoaded', () => {
            parseDOM();
        });

        function Property(key){
            this.elements = [];
            this.wasChanged = true;
            this.key = key;
        }

        const Type = Object.freeze({
            Text: 1,
            Attribute: 2,
            Iterable: 3
        })
    }

    if(typeof exports === 'object'){
        module.exports = Hokan;
    }
    else {
        window.Hokan = Hokan;
    }
})()