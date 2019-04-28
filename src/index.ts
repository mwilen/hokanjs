
class StateManager {

    data: any
    observers = [];
    updateQueue: {}[] = [];
    placeholders: any = {};

    state = {
        changed: false,
        setState: (obj) => {
            const key = Object.keys(obj)[0];
            this.updateQueue.push(this.placeholders[key] as never);
        }
    }
    
    subscribe$ = (cb) => {
        var returnProps = {...this.data};
        for(var i in this.observers){
            this.observers[i](returnProps);
        }
        typeof cb === 'function' && this.observers.push(cb);
    }
}

class Hokan extends StateManager {

    options: any;
    placeholdersRegExp = /{{(.*?)}}/g;
    valueRegExp = /[${}]/g;
    ignoredNodes = /(html|body|script|style|meta|head|link)/gi;
    prevKeys = {};
    iterables = [];
    element?: HTMLElement;
    changeDetector: ChangeDetector;

    constructor(options: any = {}) {
        super();
        this.options = options;
        this.data = options.data || {};
        if (options.el instanceof HTMLElement) {
            this.element = options.el
        }
        else if (typeof options.el === 'string') {
            this.element = document.querySelector(options.el);
        }

        this.changeDetector = new ChangeDetector(this);
        
        if(document.readyState === 'complete'){
            this.parseDOM();
        }

        window.addEventListener('DOMContentLoaded', () => {
            this.parseDOM();
        });
    }
    
    $set = (obj) => {
        this.data = {...this.data, ...obj};
    }

    parseDOM() {

        if(!this.element && this.options.el){
            this.element = document.querySelector(this.options.el);
        }

        if(!this.element && !document.body)
            return;
        
        const element = (this.element || document.body);

        (element.childNodes as NodeListOf<HTMLElement>).forEach((elem) => {
            if(elem.nodeType === 3 || (elem.tagName && !elem.tagName.match(this.ignoredNodes))){
                if(elem.attributes){
                    for(let i = 0; i < elem.attributes.length; i++){
                        let attr = elem.attributes[i];
                        if(this.findPlaceholders(attr.value)){
                            this.findPlaceholders(attr.value).forEach((match) => this.addPlaceholderElement(elem, match, Type.Attribute))
                        }
                        if(attr.name === 'hk-model'){
                            elem.addEventListener('keyup', (event: KeyboardEvent) => {
                                const value = (event.target as HTMLInputElement).value
                                this.data[attr.value] = value;
                            })

                            elem.addEventListener('keydown', () => {
                                const value = (event.target as HTMLInputElement).value
                                this.data[attr.value] = value;
                            })

                            if (this.data[attr.value]) {
                                (elem as HTMLInputElement).value = this.data[attr.value];
                            }
                            
                            this.observers.push(function(val){
                                (elem as HTMLInputElement).value = this.data[attr.value];
                            })
                        }
                        if(attr.name === 'hk-for'){
                            this.iterables.push({
                                variable: attr.value.split(' ')[1],
                                iterable: attr.value.split(' ')[3],
                                original: elem.cloneNode(true),
                                clone: elem,
                                nodes: [elem]
                            })
                            this.addPlaceholderElement(elem, attr.value.split(' ')[3], Type.Iterable)
                        }
                        if(attr.name === 'hk-html'){
                            this.addPlaceholderElement(elem, attr.value, Type.HTML)
                        }
                    }
                }
                const elemVal = elem.textContent || elem.innerText;
                if(this.findPlaceholders(elemVal).length && !this.isIterable(elem)){
                    this.findPlaceholders(elemVal).forEach((match) => this.addPlaceholderElement(elem, match, Type.Text))
                }
            }
        })
    }
    
    addPlaceholderElement(element, property, type){
        let prop = property.replace(this.valueRegExp, '');
        if(!this.placeholders[prop]){
            this.placeholders[prop] = new Property(prop);
        }
        this.placeholders[prop].elements.push({
            original: element.cloneNode(true),
            clone: element,
            type: type,
            nodes: [element]
        });
    }

    updateElements(queueElement){
        // console.log(queueElement)
        if(!queueElement)
            return;

        let keyValue = this.data[queueElement.key];
        queueElement.elements.forEach((element) => {
            this.resetElementState(element)
            if(element.type === Type.Text){
                if(element.clone.nodeType === 3){
                    element.clone.textContent = this.placeholderToValue(
                        element.clone.textContent, 
                        queueElement.key, 
                        keyValue
                    );
                }
                else {
                    element.clone.textContent = this.placeholderToValue(
                        element.clone.innerText, 
                        queueElement.key, 
                        keyValue
                    );
                }
            }
            if(element.type === Type.Attribute){
                for(let j = 0; j < element.clone.attributes.length; j++){
                    element.clone.attributes[j].value = this.placeholderToValue(
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
                    const keys = this.findPlaceholders(element.clone.innerText);


                    eval(`
                        for(let ${variable} of ${JSON.stringify(this.data[queueElement.key])}){
                            console.log(${variable});
                        }
                    `)


                    for(let i = 0; i < this.data[queueElement.key].length; i++){
                        let elem = null;
                        const value = this.data[queueElement.key];
                        if(i !== 0) {
                            elem = element.original.cloneNode(true);
                        }
                        else {
                            elem = element.nodes[0]
                        }
                        for(var key in keys){
                            let val = value[i];
                            if(this.isObject(val)){
                                val = this.getValueByObjectPath(val, keys[key])
                                elem.textContent = this.placeholderToValue(
                                    elem.textContent, 
                                    keys[key],
                                    val
                                );
                            }
                            else {
                                if(keys[key].indexOf('.') > -1){
                                    val = this.getValueByObjectPath(value, keys[key]);
                                }
                                elem.textContent = this.placeholderToValue(
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
        this.updateQueue.shift();
    }

    updateIterables() {
        this.iterables.forEach((iterable) => {
            if(!iterable.wasChanged){
                return;
            }
            
            if(!iterable.variable || !iterable.iterable){
                throw new Error('Invalid iterator expression. Expected e.g "let i of array"')
            }

            let keyValues = this.data[iterable.iterable];

            // Reset the iterable
            iterable.clone.innerText = iterable.original.innerText;
            for(let i = iterable.elems.length - 1 ; i > 0; i--){
                iterable.elems[i].parentNode.removeChild(iterable.elems[i]);
            }
            iterable.elems = [iterable.elems[0]];

            const stringPlaceholders = this.findPlaceholders(iterable.clone.innerText);
            for(let i = 0; i < keyValues.length - 1; i++){
                let elem = iterable.original.cloneNode(true);
                iterable.clone.parentNode.insertBefore(elem, iterable.elems[iterable.elems.length-1].nextSibling)
                iterable.elems.push(elem)
            }

            for(let i = 0; i < keyValues.length; i++){
                for(let p in stringPlaceholders){
                    const placeholder = stringPlaceholders[p].replace(this.valueRegExp, '')
                    let key = i;
                    if(this.isObject(keyValues[i])){
                        if(placeholder.indexOf('.') != -1){
                            key = placeholder.split('.')[1];
                            iterable.elems[i].innerHTML = this.placeholderToValue(iterable.elems[i].innerText, placeholder, keyValues[i][key]);
                        }
                        else {
                            iterable.elems[i].innerHTML = this.placeholderToValue(iterable.elems[i].innerText, placeholder, keyValues[i]);
                        }
                    }
                    else {
                        if(placeholder.indexOf('.') === -1){
                            iterable.elems[i].innerHTML = this.placeholderToValue(iterable.elems[i].innerText, placeholder, keyValues[key]);
                        }
                        else {
                            iterable.elems[i].innerHTML = this.placeholderToValue(iterable.elems[i].innerText, placeholder, undefined);
                        }
                    }
                }
            }
        })
    }

    resetElementState(element) {
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

    findPlaceholders(val){
        return val.match(this.placeholdersRegExp) || [];
    }

    isIterable(elem){
        return !!(elem.getAttribute && elem.getAttribute('hk-for'))
    }

    isObject(obj){
        return Object.getPrototypeOf(obj) === Object.prototype || false
    }

    getValueByObjectPath(object, path){
        let value = undefined;
        const self = this;
        (function fn(object, path) {
            if(!object){
                value = undefined;
                return;
            }
            path = path.replace(this.valueRegExp, '');
            const hasChild = !!path.match(/\./);
            let subPath = path.replace(self.placeholdersRegExp, '$1').slice(path.indexOf('.') - 1);
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

    updateDOM() {
        while(this.updateQueue.length){
            const item = this.updateQueue[0];
            this.updateElements(item);
        }
    }

    placeholderToValue(text, placeholder, value){
        return text.replace('{{'+ placeholder.replace(this.valueRegExp, '') + '}}', value)
    }

    clone(a){
        return JSON.parse(JSON.stringify(a));
    }
}

enum Type {
    Text,
    Attribute,
    Iterable,
    HTML
}

class Property {
    elements = [];
    constructor(private key: string) {}
}

class ChangeDetector {

    constructor(private hokan: Hokan) {
        this.changeDetector();
    }

    private changeDetector() {

        const raf = (function () {
            const w = window as any;
            return w.requestAnimationFrame 
            || w.webkitRequestAnimationFrame 
            || w.mozRequestAnimationFrame 
            || w.oRequestAnimationFrame 
            || w.msRequestAnimationFrame
            || function(cb){setTimeout(cb,1000/60)};
        })();

        const timer = () => {
            for(let i in this.hokan.data){
                if(!this.isEqual(this.hokan.data[i], this.hokan.prevKeys[i])){
                    this.hokan.prevKeys[i] = typeof this.hokan.data[i] !== 'string' ? this.hokan.clone(this.hokan.data[i]) : this.hokan.data[i];
                    const obj = {}
                    obj[i] = this.hokan.prevKeys[i];
                    this.hokan.state.setState(obj);
                }
            }
            if(this.hokan.updateQueue.length){
                // Update the DOM
                this.hokan.updateDOM();
            }
            raf(timer);
        };

        timer();
    }

    isEqual(a: any, b: any): boolean {
        if(!a || !b){
            return false;
        }
        if(typeof a === 'string' || typeof b === 'string'){
            return a === b;
        }
        else {
            return JSON.stringify(a) === JSON.stringify(b);
        }
    }

}