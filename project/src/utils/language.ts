import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { markdown } from "@codemirror/lang-markdown";
import { cpp } from "@codemirror/lang-cpp";
import type { Extension } from "@codemirror/state";

export const getLanguageExtension = (filename: string): Extension => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return javascript();
    case "ts":
      return javascript({ typescript: true });
    case "jsx":
      return javascript({ jsx: true });
    case "tsx":
      return javascript({ typescript: true, jsx: true });
    case "html":
    case "htm":
      return html();
    case "css":
    case "scss":
    case "sass":
    case "less":
      return css();
    case "json":
      return json();
    case "py":
      return python();
    case "md":
    case "markdown":
      return markdown();
    case "c":
    case "cpp":
    case "h":
    case "hpp":
    case "cc":
      return cpp();
    default:
      return [];
  }
};

export const getLanguageLabel = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return "JavaScript";
    case "ts":
      return "TypeScript";
    case "jsx":
      return "JavaScript React";
    case "tsx":
      return "TypeScript React";
    case "html":
    case "htm":
      return "HTML";
    case "css":
      return "CSS";
    case "scss":
    case "sass":
      return "SCSS";
    case "json":
      return "JSON";
    case "py":
      return "Python";
    case "md":
    case "markdown":
      return "Markdown";
    case "c":
      return "C";
    case "cpp":
    case "cc":
      return "C++";
    case "java":
      return "Java";
    case "rs":
      return "Rust";
    case "go":
      return "Go";
    case "sql":
      return "SQL";
    default:
      return "Plain Text";
  }
};
