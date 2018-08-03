const Hokan = function(keys){

    const stringRegExp = /{{(.*?)}}/g;
    const placeholders = [];
    const DOMElements = [];
    let props = keys || {};
    let prevProps = {};
    let listeners = [];

    props.onChange = function(cb){
        var returnProps = {...props};
        delete returnProps.onChange
        for(var i in listeners){
            listeners[i](returnProps);
        }
        typeof cb === 'function' && listeners.push(cb);
    }

    props.set = function(obj){
        props = {...props, ...obj};
        console.log(props)
    }

    Array.prototype.slice.call(document.querySelectorAll('*')).forEach((elem) => {
        if(elem.tagName && !elem.tagName.match(/(html|body|script|style|meta|head|link)/gi)){
            let hasPlaceholderAttr = false;
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
            }
            if(!hasPlaceholderAttr && findPlaceholders(elem.innerText)){
                elem.setAttribute('interpolator', 'on');
                DOMElements.push({original: elem.cloneNode(true), clone: elem, hasPlaceholderAttribute: hasPlaceholderAttr})
                findPlaceholders(elem.innerText).forEach((match) => {
                    placeholders.push(match);
                })
            }
        }
    })
    
    function findPlaceholders(val){
        return val.match(stringRegExp) || [];
    }

    function updateDOM(){
        DOMElements.forEach((element) => {
            element.clone.innerText = element.original.innerText;
            placeholders.forEach((p) => {
                const key = p.replace(/[${}]/g, '');
                if(element.hasPlaceholderAttribute){
                    for(let i = 0; i < element.clone.attributes.length; i++){
                        element.clone.attributes[i].value = element.clone.attributes[i].value.replace(p, props[key]);
                    }
                }
                element.clone.innerText = element.clone.innerText.replace(p, props[key]);
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

        try {
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
        } catch (err){
            throw new Error(err);
        }
    })();

    return props;
}
