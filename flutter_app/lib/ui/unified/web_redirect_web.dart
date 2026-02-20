import 'dart:html' as html;

void redirectBrowserTo(String url) {
  if (url.trim().isEmpty) return;
  html.window.location.assign(url);
}
