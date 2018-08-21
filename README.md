# hokanjs
Hokanjs is a very small and simple string interpolation library that searches the DOM and replaces placeholders.  
Works in any text (found in the DOM) as well as in attributes.  
A placeholder is a word encased with `{{}}`, e.g:  
```
<div>{{text}}</div>
<a href="{{link}}">My link</a>
```

Initialize hokan with
```
let hokan = new Hokan();
```
Or initialize it with properties

```
let hokan = new Hokan({
  text: 'Hello world!'
});
```

Once hokan is initialized you can simply set and get the properties using `hokan.keys.key`.
```
hokan.keys.text = 'This is awesome!'
console.log(hokan.keys.text) // This is awesome!

// Or set multiple key values at the same time using set
hokan.set({
  text: 'The new text'
})
```

Hokan provides a change event `onChange(fn)` which returns the old and the new values of the interpolated placeholders
```
hokan.onChange((oldKeys, newKeys) => {
  console.log(oldKeys, newKeys)
})
```

---
## Todo
- [ ] Release on NPM  
- [ ] Tests
