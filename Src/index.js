const Hokan = function(keys){

    const stringRegExp = /{{(.*?)}}/g;
    let placeholders = [];
    let DOMElements = [];
    let props = keys || {};
    let prevProps = {};
    let listeners = [];
    let models = [];

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

    function searchDOM() {
        if(!document.body)
            return;
        document.body.childNodes.forEach((elem) => {
            if(elem.nodeType === 3 || (elem.tagName && !elem.tagName.match(/(html|body|script|style|meta|head|link)/gi))){
                let hasPlaceholderAttr = false;
                if(elem.attributes){
                    for(let i = 0; i < elem.attributes.length; i++){
                        let attr = elem.attributes[i];
                        if(findPlaceholders(attr.value)){
                            findPlaceholders(attr.value).forEach((match) => {
                                hasPlaceholderAttr = true;
                                DOMElements.push({
                                    original: elem.cloneNode(true),
                                    clone: elem,
                                    hasPlaceholderAttribute: hasPlaceholderAttr
                                })
                                placeholders.push(match);
                            })
                        }
                        if(attr.name === 'hk-model'){
                            models.push({
                                elem: elem,
                                model: attr.value
                            })
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
                    }
                }
                const elemVal = elem.textContent || elem.innerText;
                if(!hasPlaceholderAttr && findPlaceholders(elemVal).length){
                    DOMElements.push({original: elem.cloneNode(true), clone: elem, hasPlaceholderAttribute: hasPlaceholderAttr})
                    findPlaceholders(elemVal).forEach((match) => {
                        elem.innerText && elem.setAttribute('hk-model', match.replace(/[${}]/g, ''));
                        placeholders.push(match);
                    })
                }
            }
        })
        console.log(models)
    }
    
    function findPlaceholders(val){
        return val.match(stringRegExp) || [];
    }

    function updateDOM(){
        DOMElements.forEach((element) => {
            if(element.clone.nodeType === 3){
                element.clone.textContent = element.original.textContent;
            }
            else {
                element.clone.innerText = element.original.innerText;
            }
            if(element.hasPlaceholderAttribute){
                for(let i = 0; i < element.clone.attributes.length; i++){
                    element.clone.attributes[i].value = element.original.attributes[i].value
                }
            }
            placeholders.forEach((p) => {
                const key = p.replace(/[${}]/g, '');
                if(element.hasPlaceholderAttribute){
                    for(let i = 0; i < element.clone.attributes.length; i++){
                        element.clone.attributes[i].value = element.clone.attributes[i].value.replace(p, props[key]);
                    }
                }
                if(element.clone.nodeType === 3){
                    element.clone.textContent = element.clone.textContent.replace(p, props[key]);
                }
                else {
                    element.clone.innerHTML = element.clone.innerText.replace(p, props[key]);
                }
            })
        })
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
        searchDOM();
    }

    window.addEventListener('DOMContentLoaded', () => {
        searchDOM() 
    });

    return props;
}