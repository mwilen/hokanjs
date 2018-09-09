# hokanjs
Hokanjs is a very small and simple string interpolation library that searches the DOM and replaces placeholders - inspired by vue.js.  
Works in any text (found in the DOM) as well as in attributes.  
A placeholder is a word encased with `{{}}`, e.g:  
```
<div>{{text}}</div>
<a href="{{link}}">My link</a>
```

Initialize hokan with
```
let vm = new Hokan();
```
Or initialize it with properties. Defining `el` is recommended however if it's not defined, `document.body` is used as root element instead.  

```
let vm = new Hokan({
  el: '.root',
  data: {
    text: 'Hello world!'
  }
});
```

Once hokan is initialized you can simply set and get the properties using `hokan.data.key`.
```
vm.data.text = 'This is awesome!'
console.log(vm.data.text) // This is awesome!

// Or set multiple key values at the same time using set
vm.set({
  text: 'The new text'
})
```

You can subscribe to changes to the view model with `subscribe$(fn)`
```
vm.subscribe$((val) => {
  console.log(val)
})
```

---
## Todo
- [ ] Release on NPM  
- [ ] Tests
