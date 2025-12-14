import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorState } from "@codemirror/state";
import { cn } from "@/lib/utils";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  isDarkMode?: boolean;
  readOnly?: boolean;
}

export function JsonEditor({
  value,
  onChange,
  className,
  isDarkMode = false,
  readOnly = false,
}: JsonEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const startState = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        json(),
        isDarkMode ? oneDark : [],
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": {
            fontSize: "14px",
            border: "2px solid var(--border)",
            borderRadius: "0.375rem",
            backgroundColor: isDarkMode
              ? "#282c34"
              : "var(--secondary-background)",
            maxHeight: "400px",
            overflow: "auto",
          },
          ".cm-content": {
            fontFamily: "ui-monospace, monospace",
            minHeight: "200px",
          },
          ".cm-scroller": {
            overflow: "auto",
            maxHeight: "400px",
          },
          ".cm-gutters": {
            backgroundColor: isDarkMode ? "#21252b" : "var(--background)",
            borderRight: "1px solid var(--border)",
          },
          ".cm-focused": {
            outline: "2px solid var(--border)",
            outlineOffset: "2px",
          },
        }),
      ],
    });

    viewRef.current = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [isDarkMode, readOnly]);

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return <div ref={editorRef} className={cn(className)} />;
}
