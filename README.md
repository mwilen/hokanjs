# hokanjs
Super small (1kB gzipped) and Simple string interpolation library
It searches the DOM and replaces placeholders.  
Works in any text as well as in attributes.  
A placeholder is a word encased with `{{}}`, e.g:  
```
<div>{{text}}</div>
<a href="{{link}}">My link</a>
```

Initialize hokan with
```
let hokan = new Hokan();
```
You can initialize it with properties as well

```
let hokan = new Hokan({
  text: 'Hello world!'
});
```

When hokan is initialized you can simply set and get the properties using `hokan.key`.
```
hokan.text = 'This is awesome!'
console.log(hokan.text) // This is awesome!
```

Hokan provides a change callback `onChange(fn)` which returns the new values of the interpolated placeholders
```
hokan.onChange((obj) => {
  console.log(obj)
})
```
