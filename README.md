# hokanjs
Hokanjs is a super small (1kB gzipped) and simple string interpolation library that searches the DOM and replaces placeholders.  
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

Once hokan is initialized you can simply set and get the properties using `hokan.key`.
```
hokan.text = 'This is awesome!'
console.log(hokan.text) // This is awesome!

// Or set multiple key values at the same time using set
hokan.set({
  text: 'The new text'
})
```

Hokan provides a change callback `onChange(fn)` which returns the new values of the interpolated placeholders
```
hokan.onChange((obj) => {
  console.log(obj)
})
```

---
## Todo
- [ ] Release on NPM  
- [ ] Tests
