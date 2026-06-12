/* @refresh reload */
import { render } from 'solid-js/web';
import { Router } from '@solidjs/router';
import { App } from './App';
import { routes } from './router';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

render(
  () => (
    <Router root={App}>{routes}</Router>
  ),
  root,
);
