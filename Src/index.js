const Hokan = function(keys){

    const stringRegExp = /{{(.*?)}}/g;
    let DOMElements = [];
    let props = keys || {};
    let placeholders = {};
    let prevProps = {};
    let listeners = [];
    let iterables = [];

    function Property(){
        this.elements = [];
        this.wasChanged = true;
    }

    props.onChange = function(cb){
        var returnProps = {...props};
        delete returnProps.onChange;
        delete returnProps.set;
        for(var i in listeners){
            listeners[i](returnProps);
        }
        typeof cb === 'function' && listeners.push(cb);
    }

    props.set = function(obj){
        props = {...props, ...obj};
    }

    function parseDOM() {
        if(!document.body)
            return;
        document.body.childNodes.forEach((elem) => {
            if(elem.nodeType === 3 || (elem.tagName && !elem.tagName.match(/(html|body|script|style|meta|head|link)/gi))){
                let hasPlaceholderAttr = false;
                if(elem.attributes){
                    for(let i = 0; i < elem.attributes.length; i++){
                        let attr = elem.attributes[i];
                        if(findPlaceholders(attr.value)){
                            findPlaceholders(attr.value).forEach((match) => addPlaceholderElement(elem, match, true))
                        }
                        if(attr.name === 'hk-model'){
                            elem.addEventListener('keyup', function(){
                                props[attr.value] = this.value;
                            })
                            elem.addEventListener('keydown', function(){
                                props[attr.value] = this.value;
                            })
                            if(props[attr.value]){
                                elem.value = props[attr.value];
                            }
                        }
                        if(attr.name === 'hk-for'){
                            iterables.push({
                                variable: attr.value.split(' ')[1],
                                iterable: attr.value.split(' ')[3],
                                original: elem.cloneNode(true),
                                clone: elem,
                                elems: [elem]
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
        console.log(placeholders)
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

    function updateElements(){
        
        for(let i in placeholders){
            let property = placeholders[i];
            if(property.wasChanged){
                property.elements.forEach((element) => resetElementState(element));
            }
        }
        for(let i in placeholders){
            let property = placeholders[i];
            let prop = props[i];
            if(property.wasChanged){
                property.elements.forEach((element) => {
                    if(element.hasAttributes){
                        for(let j = 0; j < element.clone.attributes.length; j++){
                            element.clone.attributes[j].value = placeholderToValue(element.clone.attributes[j].value, '{{'+ i + '}}', prop);
                        }
                    }
                    if(element.clone.nodeType === 3){
                        element.clone.textContent = placeholderToValue(element.clone.textContent, '{{'+ i + '}}', prop);
                    }
                    else {
                        element.clone.innerHTML = placeholderToValue(element.clone.innerText, '{{'+ i + '}}', prop);
                    }
                })
                property.wasChanged = false;
            }
        }
    }

    function resetElementState(element) {
        if(element.clone.nodeType === 3){
            element.clone.textContent = element.original.textContent;
        }
        else {
            element.clone.innerText = element.original.innerText;
        }
        if(element.hasAttributes){
            for(let i = 0; i < element.original.attributes.length; i++){
                element.clone.attributes[i].value = element.original.attributes[i].value
            }
        }
    }

    function updateIterables(){
        console.log(iterables)
        iterables.forEach((iterable) => {
            let propVals = props[iterable.iterable];
            iterable.clone.innerText = iterable.original.innerText;
            for(var i = iterable.elems.length - 1 ; i > 0; i--){
                iterable.elems[i].parentNode.removeChild(iterable.elems[i]);
            }
            iterable.elems = [iterable.elems[0]];
            const placeholders = findPlaceholders(iterable.clone.innerText);
            for(var i = 0; i < propVals.length - 1; i++){
                let elem = document.createElement(iterable.original.tagName);
                elem.innerHTML = iterable.original.innerHTML;
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
        })
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

        const caf = (function(){
            return window.cancelAnimationFrame 
            || window.mozCancelAnimationFrame 
            || function(cb){ window.clearTimeout(cb) };
        })();

        (function timer(){
            let propsChanged = false;
            for(let i in props){
                if(props[i] !== prevProps[i]){
                    prevProps[i] = props[i];
                    placeholders[i] && (placeholders[i].wasChanged = true);
                    propsChanged = true;
                }
            }
            // If a property/value was changed
            if(propsChanged){
                // Update the DOM
                updateDOM();
                // Notify possible listeners that a change occurred
                props.onChange();
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

    return props;
}