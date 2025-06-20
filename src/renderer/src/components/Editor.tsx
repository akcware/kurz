import '@blocknote/core/fonts/inter.css'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import { ChangeEvent, useCallback, useEffect } from 'react'

export default function Editor({ initialMarkdown, onChange }: { initialMarkdown: string, onChange?: (content: string) => void }) {
  // Creates a new editor instance.
  const editor = useCreateBlockNote()


   // For initialization; on mount, convert the initial Markdown to blocks and replace the default editor's content
  useEffect(() => {
    async function loadInitialHTML() {
      const blocks = await editor.tryParseMarkdownToBlocks(initialMarkdown);
      editor.replaceBlocks(editor.document, blocks);
    }
    loadInitialHTML();
  }, [editor]);

  // Renders the editor instance using a React component.
  return <BlockNoteView editor={editor} shadCNComponents={{}} />
}
