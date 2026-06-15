// foliate-js 没有 .d.ts,这些模块都是 JS 写并 export 默认对象 / 工厂函数
// 用 ambient declaration 告诉 TS 把它们当 any-like 模块看
declare module 'foliate-js/epub.js' {
  const EPUB: any;
  const makeBook: any;
  export { EPUB, makeBook };
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
declare module 'foliate-js/view.js' {
  const makeBook: any;
  const View: any;
  const ResponseError: any;
  const NotFoundError: any;
  const UnsupportedTypeError: any;
  export { makeBook, View, ResponseError, NotFoundError, UnsupportedTypeError };
  export default makeBook;
}
declare module 'foliate-js/paginator.js' {
  const Paginator: any;
  export { Paginator };
  export default Paginator;
}
declare module 'foliate-js/progress.js' {
  const TOCProgress: any;
  const SectionProgress: any;
  const PageProgress: any;
  export { TOCProgress, SectionProgress, PageProgress };
}
declare module 'foliate-js/overlayer.js' {
  const Overlayer: any;
  export { Overlayer };
  export default Overlayer;
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
