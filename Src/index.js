const Hokan = function(keys){

    const self = this;

    const stringRegExp = /{{(.*?)}}/g;
    let placeholders = {};
    let prevKeys = {};
    let tempPrevKeys = {};
    let listeners = [];
    let iterables = [];
    
    this.keys = keys || {};
    
    this.onChange = function(cb){
        var returnProps = {...this.keys};
        for(var i in listeners){
            listeners[i](tempPrevKeys, returnProps);
        }
        typeof cb === 'function' && listeners.push(cb);
    }
    
    this.set = function(obj){
        this.keys = {...this.keys, ...obj};
    }

    Object.freeze(this);

    function parseDOM() {
        if(!document.body)
            return;
        document.body.childNodes.forEach((elem) => {
            if(elem.nodeType === 3 || (elem.tagName && !elem.tagName.match(/(html|body|script|style|meta|head|link)/gi))){
                if(elem.attributes){
                    for(let i = 0; i < elem.attributes.length; i++){
                        let attr = elem.attributes[i];
                        if(findPlaceholders(attr.value)){
                            findPlaceholders(attr.value).forEach((match) => addPlaceholderElement(elem, match, true))
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
                        }
                    }
                }
                const elemVal = elem.textContent || elem.innerText;
                if(findPlaceholders(elemVal).length && !isIterable(elem)){
                    findPlaceholders(elemVal).forEach((match) => addPlaceholderElement(elem, match))
                }
            }
        })
    }
    
    function addPlaceholderElement(element, property, isAttribute){
        let prop = property.replace(/[${}]/g, '');
        isAttribute = isAttribute || false;
        if(!placeholders[prop]){
            placeholders[prop] = new Property();
        }
        placeholders[prop].elements.push({
            original: element.cloneNode(true),
            clone: element,
            hasAttributes: isAttribute
        });
    }

    function updateElements(){
        
        for(let i in placeholders){
            let placeholder = placeholders[i];
            if(placeholder.wasChanged){
                placeholder.elements.forEach((element) => resetElementState(element));
            }
        }

        for(let i in placeholders){
            let placeholder = placeholders[i];
            let prop = self.keys[i];
            if(placeholder.wasChanged){
                placeholder.elements.forEach((element) => {
                    if(element.clone.nodeType === 3){
                        element.clone.textContent = placeholderToValue(
                            element.clone.textContent, 
                            '{{'+ i + '}}', 
                            prop
                        );
                    }
                    else {
                        element.clone.innerHTML = placeholderToValue(
                            element.clone.innerText, 
                            '{{'+ i + '}}', 
                            prop
                        );
                    }
                    if(element.hasAttributes){
                        for(let j = 0; j < element.clone.attributes.length; j++){
                            element.clone.attributes[j].value = placeholderToValue(
                                element.clone.attributes[j].value, 
                                '{{'+ i + '}}', 
                                prop
                            );
                        }
                    }
                })
                // Reset state
                placeholder.wasChanged = false;
            }
        }
    }

    function updateIterables(){
        iterables.forEach((iterable) => {
            if(!iterable.wasChanged){
                return;
            }
            if(!iterable.variable || !iterable.iterable){
                throw new Error('Invalid iterator expression. Expected e.g "let i of array"')
            }
            let propVals = self.keys[iterable.iterable];
            iterable.clone.innerText = iterable.original.innerText;
            for(var i = iterable.elems.length - 1 ; i > 0; i--){
                iterable.elems[i].parentNode.removeChild(iterable.elems[i]);
            }
            iterable.elems = [iterable.elems[0]];
            const placeholders = findPlaceholders(iterable.clone.innerText);
            for(var i = 0; i < propVals.length - 1; i++){
                let elem = iterable.original.cloneNode(true);
                iterable.clone.parentNode.insertBefore(elem, iterable.elems[iterable.elems.length-1].nextSibling)
                iterable.elems.push(elem)
            }
            for(var i = 0; i < propVals.length; i++){
                for(let p of placeholders){
                    let key = i;
                    const ph = p.replace(/[${}]/g, '');
                    if(isObject(propVals[i])){
                        if(ph.indexOf('.') != -1){
                            key = ph.split('.')[1];
                            iterable.elems[i].innerHTML = placeholderToValue(iterable.elems[i].innerText, p, propVals[i][key]);
                        }
                        else {
                            iterable.elems[i].innerHTML = placeholderToValue(iterable.elems[i].innerText, p, propVals[i]);
                        }
                    }
                    else {
                        if(ph.indexOf('.') === -1){
                            iterable.elems[i].innerHTML = placeholderToValue(iterable.elems[i].innerText, p, propVals[key]);
                        }
                        else {
                            iterable.elems[i].innerHTML = placeholderToValue(iterable.elems[i].innerText, p, undefined);
                        }
                    }
                }
            }
            iterable.wasChanged = false;
        })
    }

    function resetElementState(element) {
        if(!element.hasAttributes){
            if(element.clone.nodeType === 3){
                element.clone.textContent = element.original.textContent;
            }
            else {
                element.clone.innerText = element.original.innerText;
            }
        }
        if(element.hasAttributes){
            for(let i = 0; i < element.original.attributes.length; i++){
                element.clone.attributes[i].value = element.original.attributes[i].value
            }
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
        updateElements();
        updateIterables();
    }

    function placeholderToValue(text, placeholder, value){
        return text.replace(placeholder, value)
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
            let propsChanged = false;
            for(let i in self.keys){
                tempPrevKeys[i] = prevKeys[i];
                if(self.keys[i] !== prevKeys[i]){
                    prevKeys[i] = self.keys[i];
                    placeholders[i] && (placeholders[i].wasChanged = true);
                    for(let j in iterables){
                        if(iterables[j].iterable === i){
                            iterables[j].wasChanged = true;
                        }
                    }
                    propsChanged = true;
                }
            }
            // If a property/value was changed
            if(propsChanged){
                // Update the DOM
                updateDOM();
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
        parseDOM() 
    });

    function Property(){
        this.elements = [];
        this.wasChanged = true;
    }
}