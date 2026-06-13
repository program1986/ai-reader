// foliate-js 没有 .d.ts,这些模块都是 JS 写并 export 默认对象 / 工厂函数
// 用 ambient declaration 告诉 TS 把它们当 any-like 模块看
declare module 'foliate-js/epub.js' {
  const makeBook: any;
  export { makeBook };
  export default makeBook;
}
declare module 'foliate-js/mobi.js' {
  const makeBook: any;
  export { makeBook };
  export default makeBook;
}
declare module 'foliate-js/fb2.js' {
  const makeBook: any;
  export { makeBook };
  export default makeBook;
}
declare module 'foliate-js/comic-book.js' {
  const makeBook: any;
  export { makeBook };
  export default makeBook;
}
declare module 'foliate-js/view' {
  const View: any;
  export { View };
  export default View;
}
declare module 'foliate-js/annotation' {
  const Annotation: any;
  export { Annotation };
  export default Annotation;
}
declare module 'foliate-js/footnote' {
  const Footnote: any;
  export { Footnote };
  export default Footnote;
}
