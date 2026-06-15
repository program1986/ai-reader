/* @refresh reload */
import { render } from 'solid-js/web';
import { Router } from '@solidjs/router';
import { App } from './App';
import { routes } from './router';
import { wlog } from './services/webview-log';
import './index.css';

wlog('info', 'main.tsx: module loaded').catch(() => {});

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

wlog('info', 'main.tsx: root found, rendering').catch(() => {});

render(
  () => (
    <Router root={App}>{routes}</Router>
  ),
  root,
);

wlog('info', 'main.tsx: render() called').catch(() => {});
