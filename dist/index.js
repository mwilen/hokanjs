var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var StateManager = (function () {
    function StateManager() {
        var _this = this;
        this.observers = [];
        this.updateQueue = [];
        this.placeholders = {};
        this.state = {
            changed: false,
            setState: function (obj) {
                var key = Object.keys(obj)[0];
                _this.updateQueue.push(_this.placeholders[key]);
            }
        };
        this.subscribe$ = function (cb) {
            var returnProps = __assign({}, _this.data);
            for (var i in _this.observers) {
                _this.observers[i](returnProps);
            }
            typeof cb === 'function' && _this.observers.push(cb);
        };
    }
    return StateManager;
}());
var Hokan = (function (_super) {
    __extends(Hokan, _super);
    function Hokan(options) {
        if (options === void 0) { options = {}; }
        var _this = _super.call(this) || this;
        _this.placeholdersRegExp = /{{(.*?)}}/g;
        _this.valueRegExp = /[${}]/g;
        _this.ignoredNodes = /(html|body|script|style|meta|head|link)/gi;
        _this.prevKeys = {};
        _this.iterables = [];
        _this.$set = function (obj) {
            _this.data = __assign({}, _this.data, obj);
        };
        _this.options = options;
        _this.data = options.data || {};
        if (options.el instanceof HTMLElement) {
            _this.element = options.el;
        }
        else if (typeof options.el === 'string') {
            _this.element = document.querySelector(options.el);
        }
        _this.changeDetector = new ChangeDetector(_this);
        if (document.readyState === 'complete') {
            _this.parseDOM();
        }
        window.addEventListener('DOMContentLoaded', function () {
            _this.parseDOM();
        });
        return _this;
    }
    Hokan.prototype.parseDOM = function () {
        var _this = this;
        if (!this.element && this.options.el) {
            this.element = document.querySelector(this.options.el);
        }
        if (!this.element && !document.body)
            return;
        var element = (this.element || document.body);
        element.childNodes.forEach(function (elem) {
            if (elem.nodeType === 3 || (elem.tagName && !elem.tagName.match(_this.ignoredNodes))) {
                if (elem.attributes) {
                    var _loop_1 = function (i) {
                        var attr = elem.attributes[i];
                        if (_this.findPlaceholders(attr.value)) {
                            _this.findPlaceholders(attr.value).forEach(function (match) { return _this.addPlaceholderElement(elem, match, Type.Attribute); });
                        }
                        if (attr.name === 'hk-model') {
                            elem.addEventListener('keyup', function (event) {
                                var value = event.target.value;
                                _this.data[attr.value] = value;
                            });
                            elem.addEventListener('keydown', function () {
                                var value = event.target.value;
                                _this.data[attr.value] = value;
                            });
                            if (_this.data[attr.value]) {
                                elem.value = _this.data[attr.value];
                            }
                            _this.observers.push(function (val) {
                                elem.value = this.data[attr.value];
                            });
                        }
                        if (attr.name === 'hk-for') {
                            _this.iterables.push({
                                variable: attr.value.split(' ')[1],
                                iterable: attr.value.split(' ')[3],
                                original: elem.cloneNode(true),
                                clone: elem,
                                nodes: [elem]
                            });
                            _this.addPlaceholderElement(elem, attr.value.split(' ')[3], Type.Iterable);
                        }
                        if (attr.name === 'hk-html') {
                            _this.addPlaceholderElement(elem, attr.value, Type.HTML);
                        }
                    };
                    for (var i = 0; i < elem.attributes.length; i++) {
                        _loop_1(i);
                    }
                }
                var elemVal = elem.textContent || elem.innerText;
                if (_this.findPlaceholders(elemVal).length && !_this.isIterable(elem)) {
                    _this.findPlaceholders(elemVal).forEach(function (match) { return _this.addPlaceholderElement(elem, match, Type.Text); });
                }
            }
        });
    };
    Hokan.prototype.addPlaceholderElement = function (element, property, type) {
        var prop = property.replace(this.valueRegExp, '');
        if (!this.placeholders[prop]) {
            this.placeholders[prop] = new Property(prop);
        }
        this.placeholders[prop].elements.push({
            original: element.cloneNode(true),
            clone: element,
            type: type,
            nodes: [element]
        });
    };
    Hokan.prototype.updateElements = function (queueElement) {
        var _this = this;
        if (!queueElement)
            return;
        var keyValue = this.data[queueElement.key];
        queueElement.elements.forEach(function (element) {
            _this.resetElementState(element);
            if (element.type === Type.Text) {
                if (element.clone.nodeType === 3) {
                    element.clone.textContent = _this.placeholderToValue(element.clone.textContent, queueElement.key, keyValue);
                }
                else {
                    element.clone.textContent = _this.placeholderToValue(element.clone.innerText, queueElement.key, keyValue);
                }
            }
            if (element.type === Type.Attribute) {
                for (var j = 0; j < element.clone.attributes.length; j++) {
                    element.clone.attributes[j].value = _this.placeholderToValue(element.clone.attributes[j].value, queueElement.key, keyValue);
                }
            }
            if (element.type === Type.Iterable) {
                var modelValue = element.original.getAttribute('hk-for');
                var variable = modelValue.split(' ')[1];
                var iterable = modelValue.split(' ')[3];
                var keys = _this.findPlaceholders(element.clone.innerText);
                eval("\n                        for(let " + variable + " of " + JSON.stringify(_this.data[queueElement.key]) + "){\n                            console.log(" + variable + ");\n                        }\n                    ");
                for (var i = 0; i < _this.data[queueElement.key].length; i++) {
                    var elem = null;
                    var value = _this.data[queueElement.key];
                    if (i !== 0) {
                        elem = element.original.cloneNode(true);
                    }
                    else {
                        elem = element.nodes[0];
                    }
                    for (var key in keys) {
                        var val = value[i];
                        if (_this.isObject(val)) {
                            val = _this.getValueByObjectPath(val, keys[key]);
                            elem.textContent = _this.placeholderToValue(elem.textContent, keys[key], val);
                        }
                        else {
                            if (keys[key].indexOf('.') > -1) {
                                val = _this.getValueByObjectPath(value, keys[key]);
                            }
                            elem.textContent = _this.placeholderToValue(elem.textContent, keys[key], val);
                        }
                    }
                    if (i !== 0) {
                        element.clone.parentNode.insertBefore(elem, element.nodes[element.nodes.length - 1].nextSibling);
                        element.nodes.push(elem);
                    }
                }
            }
        });
        this.updateQueue.shift();
    };
    Hokan.prototype.updateIterables = function () {
        var _this = this;
        this.iterables.forEach(function (iterable) {
            if (!iterable.wasChanged) {
                return;
            }
            if (!iterable.variable || !iterable.iterable) {
                throw new Error('Invalid iterator expression. Expected e.g "let i of array"');
            }
            var keyValues = _this.data[iterable.iterable];
            iterable.clone.innerText = iterable.original.innerText;
            for (var i = iterable.elems.length - 1; i > 0; i--) {
                iterable.elems[i].parentNode.removeChild(iterable.elems[i]);
            }
            iterable.elems = [iterable.elems[0]];
            var stringPlaceholders = _this.findPlaceholders(iterable.clone.innerText);
            for (var i = 0; i < keyValues.length - 1; i++) {
                var elem = iterable.original.cloneNode(true);
                iterable.clone.parentNode.insertBefore(elem, iterable.elems[iterable.elems.length - 1].nextSibling);
                iterable.elems.push(elem);
            }
            for (var i = 0; i < keyValues.length; i++) {
                for (var p in stringPlaceholders) {
                    var placeholder = stringPlaceholders[p].replace(_this.valueRegExp, '');
                    var key = i;
                    if (_this.isObject(keyValues[i])) {
                        if (placeholder.indexOf('.') != -1) {
                            key = placeholder.split('.')[1];
                            iterable.elems[i].innerHTML = _this.placeholderToValue(iterable.elems[i].innerText, placeholder, keyValues[i][key]);
                        }
                        else {
                            iterable.elems[i].innerHTML = _this.placeholderToValue(iterable.elems[i].innerText, placeholder, keyValues[i]);
                        }
                    }
                    else {
                        if (placeholder.indexOf('.') === -1) {
                            iterable.elems[i].innerHTML = _this.placeholderToValue(iterable.elems[i].innerText, placeholder, keyValues[key]);
                        }
                        else {
                            iterable.elems[i].innerHTML = _this.placeholderToValue(iterable.elems[i].innerText, placeholder, undefined);
                        }
                    }
                }
            }
        });
    };
    Hokan.prototype.resetElementState = function (element) {
        if (element.type === Type.Text) {
            if (element.clone.nodeType === 3) {
                element.clone.textContent = element.original.textContent;
            }
            else {
                element.clone.innerText = element.original.innerText;
            }
        }
        else if (element.type === Type.Attribute) {
            for (var i = 0; i < element.original.attributes.length; i++) {
                element.clone.attributes[i].value = element.original.attributes[i].value;
            }
        }
        else if (element.type === Type.Iterable) {
            element.clone.textContent = element.original.innerText;
            for (var i = element.nodes.length - 1; i > 0; i--) {
                element.nodes[i].parentNode.removeChild(element.nodes[i]);
            }
            element.nodes = [element.nodes[0]];
        }
    };
    Hokan.prototype.findPlaceholders = function (val) {
        return val.match(this.placeholdersRegExp) || [];
    };
    Hokan.prototype.isIterable = function (elem) {
        return !!(elem.getAttribute && elem.getAttribute('hk-for'));
    };
    Hokan.prototype.isObject = function (obj) {
        return Object.getPrototypeOf(obj) === Object.prototype || false;
    };
    Hokan.prototype.getValueByObjectPath = function (object, path) {
        var value = undefined;
        var self = this;
        (function fn(object, path) {
            if (!object) {
                value = undefined;
                return;
            }
            path = path.replace(this.valueRegExp, '');
            var hasChild = !!path.match(/\./);
            var subPath = path.replace(self.placeholdersRegExp, '$1').slice(path.indexOf('.') + 1);
            if (hasChild && subPath) {
                if (object.hasOwnProperty(subPath)) {
                    value = object[subPath];
                }
                else if (subPath.indexOf('.') !== -1) {
                    fn(object[subPath.split('.')[0]], subPath);
                }
                else {
                    value = undefined;
                }
            }
            else {
                if (object.hasOwnProperty(path)) {
                    value = object[path];
                }
                else {
                    value = object;
                }
            }
        })(object, path);
        return value;
    };
    Hokan.prototype.updateDOM = function () {
        while (this.updateQueue.length) {
            var item = this.updateQueue[0];
            this.updateElements(item);
        }
    };
    Hokan.prototype.placeholderToValue = function (text, placeholder, value) {
        return text.replace('{{' + placeholder.replace(this.valueRegExp, '') + '}}', value);
    };
    Hokan.prototype.clone = function (a) {
        return JSON.parse(JSON.stringify(a));
    };
    return Hokan;
}(StateManager));
var Type;
(function (Type) {
    Type[Type["Text"] = 0] = "Text";
    Type[Type["Attribute"] = 1] = "Attribute";
    Type[Type["Iterable"] = 2] = "Iterable";
    Type[Type["HTML"] = 3] = "HTML";
})(Type || (Type = {}));
var Property = (function () {
    function Property(key) {
        this.key = key;
        this.elements = [];
    }
    return Property;
}());
var ChangeDetector = (function () {
    function ChangeDetector(hokan) {
        this.hokan = hokan;
        this.changeDetector();
    }
    ChangeDetector.prototype.changeDetector = function () {
        var _this = this;
        var raf = (function () {
            var w = window;
            return w.requestAnimationFrame
                || w.webkitRequestAnimationFrame
                || w.mozRequestAnimationFrame
                || w.oRequestAnimationFrame
                || w.msRequestAnimationFrame
                || function (cb) { setTimeout(cb, 1000 / 60); };
        })();
        var timer = function () {
            for (var i in _this.hokan.data) {
                if (!_this.isEqual(_this.hokan.data[i], _this.hokan.prevKeys[i])) {
                    _this.hokan.prevKeys[i] = typeof _this.hokan.data[i] !== 'string' ? _this.hokan.clone(_this.hokan.data[i]) : _this.hokan.data[i];
                    var obj = {};
                    obj[i] = _this.hokan.prevKeys[i];
                    _this.hokan.state.setState(obj);
                }
            }
            if (_this.hokan.updateQueue.length) {
                _this.hokan.updateDOM();
            }
            raf(timer);
        };
        timer();
    };
    ChangeDetector.prototype.isEqual = function (a, b) {
        if (!a || !b) {
            return false;
        }
        if (typeof a === 'string' || typeof b === 'string') {
            return a === b;
        }
        else {
            return JSON.stringify(a) === JSON.stringify(b);
        }
    };
    return ChangeDetector;
}());
//# sourceMappingURL=index.js.map