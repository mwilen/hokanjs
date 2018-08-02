# hokanjs
Super small and simple string interpolator
It searches the DOM and replaces placeholders.
A placeholder is a word encased with `{{}}`, e.g `{{text}}`

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
```

Hokan provides a change listener `onChange(fn)` and which returns the new values of the interpolated placeholders
```
hokan.onChange((obj) => {
  console.log(obj)
})
```
