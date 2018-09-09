(function(){
    const Hokan = function(options){

        options = options || {};

        const self = this;

        const placeholdersRegExp = /{{(.*?)}}/g;
        const valueRegExp = /[${}]/g;
        const ignoredNodes = /(html|body|script|style|meta|head|link)/gi;
        let placeholders = {};
        let prevKeys = {};
        let observers = [];
        let iterables = [];

        let element = null;
        
        this.data = options.data || {};

        const state = {
            updateQueue: [],
            changed: false,
            setState: function(obj){
                const key = Object.keys(obj)[0];
                this.updateQueue.push(placeholders[key])
                self[key] = self.data[key];
                self.subscribe$();
            }
        }
        
        this.subscribe$ = (cb) => {
            var returnProps = {...this.data};
            for(var i in observers){
                observers[i](returnProps);
            }
            typeof cb === 'function' && observers.push(cb);
        }
        
        this.$set = (obj) => {
            this.data = {...this.data, ...obj};
        }

        Object.freeze(this);

        function parseDOM() {

            if(!element && options.el){
                element = document.querySelector(options.el);
            }

            if(!element && !document.body)
                return;

            (element || document.body).childNodes.forEach((elem) => {
                if(elem.nodeType === 3 || (elem.tagName && !elem.tagName.match(ignoredNodes))){
                    if(elem.attributes){
                        for(let i = 0; i < elem.attributes.length; i++){
                            let attr = elem.attributes[i];
                            if(findPlaceholders(attr.value)){
                                findPlaceholders(attr.value).forEach((match) => addPlaceholderElement(elem, match, Type.Attribute))
                            }
                            if(attr.name === 'hk-model'){
                                elem.addEventListener('keyup', function(){
                                    self.data[attr.value] = this.value;
                                })
                                elem.addEventListener('keydown', function(){
                                    self.data[attr.value] = this.value;
                                })
                                if(self.data[attr.value]){
                                    elem.value = self.data[attr.value];
                                }
                                observers.push(function(val){
                                    elem.value = self.data[attr.value];
                                })
                            }
                            if(attr.name === 'hk-for'){
                                iterables.push({
                                    variable: attr.value.split(' ')[1],
                                    iterable: attr.value.split(' ')[3],
                                    original: elem.cloneNode(true),
                                    clone: elem,
                                    nodes: [elem]
                                })
                                addPlaceholderElement(elem, attr.value.split(' ')[3], Type.Iterable)
                            }
                            if(attr.name === 'hk-html'){
                                addPlaceholderElement(elem, attr.value, Type.HTML)
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
            let prop = property.replace(valueRegExp, '');
            if(!placeholders[prop]){
                placeholders[prop] = new Property(prop);
            }
            placeholders[prop].elements.push({
                original: element.cloneNode(true),
                clone: element,
                type: type,
                nodes: [element]
            });
        }

        function updateElements(queueElement){

            if(!queueElement)
                return;

            let keyValue = self.data[queueElement.key];
            queueElement.elements.forEach((element) => {
                resetElementState(element)
                if(element.type === Type.Text){
                    if(element.clone.nodeType === 3){
                        element.clone.textContent = placeholderToValue(
                            element.clone.textContent, 
                            queueElement.key, 
                            keyValue
                        );
                    }
                    else {
                        element.clone.textContent = placeholderToValue(
                            element.clone.innerText, 
                            queueElement.key, 
                            keyValue
                        );
                    }
                }
                if(element.type === Type.Attribute){
                    for(let j = 0; j < element.clone.attributes.length; j++){
                        element.clone.attributes[j].value = placeholderToValue(
                            element.clone.attributes[j].value, 
                            queueElement.key, 
                            keyValue
                        );
                    }
                }
                if(element.type === Type.Iterable){
                    const modelValue = element.original.getAttribute('hk-for');
                    // try{
                        const variable = modelValue.split(' ')[1];
                        const iterable = modelValue.split(' ')[3];
                        const keys = findPlaceholders(element.clone.innerText);

            // eval('for(let ' + variable + ' of '+JSON.stringify(self.data[queueElement.key])+'){ console.log('+variable+') }')
                        for(let i = 0; i < self.data[queueElement.key].length; i++){
                            let elem = null;
                            const value = self.data[queueElement.key];
                            if(i !== 0) {
                                elem = element.original.cloneNode(true);
                            }
                            else {
                                elem = element.nodes[0]
                            }
                            for(var key in keys){
                                let val = value[i];
                                if(isObject(val)){
                                    val = getValueByObjectPath(val, keys[key])
                                    elem.textContent = placeholderToValue(
                                        elem.textContent, 
                                        keys[key],
                                        val
                                    );
                                }
                                else {
                                    if(keys[key].indexOf('.') > -1){
                                        val = getValueByObjectPath(value, keys[key]);
                                    }
                                    elem.textContent = placeholderToValue(
                                        elem.textContent, 
                                        keys[key],
                                        val
                                    );
                                }
                            }
                            if(i !== 0){
                                element.clone.parentNode.insertBefore(elem, element.nodes[element.nodes.length-1].nextSibling)
                                element.nodes.push(elem)
                            }
                        }
                    // }
                    // catch(e){
                    //     throw new Error('Invalid iterator expression. Expected e.g "let i of array"')
                    // }
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

                let keyValues = self.data[iterable.iterable];

                // Reset the iterable
                iterable.clone.innerText = iterable.original.innerText;
                for(let i = iterable.elems.length - 1 ; i > 0; i--){
                    iterable.elems[i].parentNode.removeChild(iterable.elems[i]);
                }
                iterable.elems = [iterable.elems[0]];

                const stringPlaceholders = findPlaceholders(iterable.clone.innerText);
                for(let i = 0; i < keyValues.length - 1; i++){
                    let elem = iterable.original.cloneNode(true);
                    iterable.clone.parentNode.insertBefore(elem, iterable.elems[iterable.elems.length-1].nextSibling)
                    iterable.elems.push(elem)
                }

                for(let i = 0; i < keyValues.length; i++){
                    for(let p in stringPlaceholders){
                        const placeholder = stringPlaceholders[p].replace(valueRegExp, '')
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
            else if(element.type === Type.Attribute){
                for(let i = 0; i < element.original.attributes.length; i++){
                    element.clone.attributes[i].value = element.original.attributes[i].value
                }
            }
            else if(element.type === Type.Iterable){
                element.clone.textContent = element.original.innerText;
                for(let i = element.nodes.length - 1 ; i > 0; i--){
                    element.nodes[i].parentNode.removeChild(element.nodes[i]);
                }
                element.nodes = [element.nodes[0]];
            }
        }

        function findPlaceholders(val){
            return val.match(placeholdersRegExp) || [];
        }

        function isIterable(elem){
            return !!(elem.getAttribute && elem.getAttribute('hk-for'))
        }

        function isObject(obj){
            return Object.getPrototypeOf(obj) === Object.prototype || false
        }

        function getValueByObjectPath(object, path){
            let value = undefined;
            (function fn(object, path){
                if(!isObject(object)){
                    value = undefined;
                    return;
                }
                path = path.replace(valueRegExp, '');
                const hasChild = !!path.match(/\./);
                let subPath = path.slice(path.indexOf('.') + 1);
                if(hasChild && subPath){
                    if(object.hasOwnProperty(subPath)){
                        value = object[subPath];
                    }
                    else if(subPath.indexOf('.') !== -1){
                        fn(object[subPath.split('.')[0]], subPath)
                    }
                    else {
                        value = undefined;
                    }
                }
                else {
                    if(object.hasOwnProperty(path)){
                        value = object[path];
                    }
                    else {
                        value = object;
                    }
                }
            })(object, path);
            return value;
        }

        function updateDOM(){
            state.updateQueue.forEach((item) => updateElements(item))
            // updateIterables();
        }

        function placeholderToValue(text, placeholder, value){
            return text.replace('{{'+ placeholder.replace(valueRegExp, '') + '}}', value)
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
                for(let i in self.data){
                    if(self.data[i] !== prevKeys[i]){
                        prevKeys[i] = {...self.data[i]};
                        const obj = {}
                        obj[i] = prevKeys[i];
                        state.setState(obj);
                        // Update the DOM
                        updateDOM();
                    }
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
            this.key = key;
        }

        const Type = Object.freeze({
            Text: 1,
            Attribute: 2,
            Iterable: 3,
            HTML: 4
        })
    }

    if(typeof exports === 'object'){
        module.exports = Hokan;
    }
    else {
        window.Hokan = Hokan;
    }
})()