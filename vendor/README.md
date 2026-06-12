# 第三方 vendor 代码

本目录存放路径依赖(非 npm registry)的源码。

## foliate-js

电子书中枢渲染引擎,EPUB / MOBI / FB2 / CBZ 的核心。

来源:`../ebook-with-ai/packages/foliate-js`(Readest monorepo 的 git submodule)。

协议:MIT(原作者 John Schember)

### 链接方式

```bash
# 方式 A:符号链接
ln -s ../../ebook-with-ai/packages/foliate-js ./foliate-js

# 方式 B:拷贝
cp -r ../../ebook-with-ai/packages/foliate-js ./foliate-js
```

### 选 B 之后的 `package.json`

```json
{
  "dependencies": {
    "foliate-js": "file:./foliate-js"
  }
}
```

`pnpm install` 后,Vite/TypeScript 就能直接 import:

```ts
import { makeBook } from 'foliate-js/view.js';
import { Annotation } from 'foliate-js/annotation.js';
```

### 注意

- foliate-js 的 main 入口是 `view.js`,在 Vite 中需要 `import 'foliate-js/view'`
- 该包内部引用了 `../foliate-js/...` 相对路径,file: 依赖能解决
