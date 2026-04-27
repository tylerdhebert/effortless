import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const markdownComponents: Components = {
  h1: ({ children }) => <h1>{children}</h1>,
  h2: ({ children }) => <h2>{children}</h2>,
  h3: ({ children }) => <h3>{children}</h3>,
  p: ({ children }) => <p>{children}</p>,
  ul: ({ children }) => <ul>{children}</ul>,
  ol: ({ children }) => <ol>{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  blockquote: ({ children }) => <blockquote>{children}</blockquote>,
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = String(children ?? '').replace(/\n$/, '')
    if ((className ?? '').includes('language-') || text.includes('\n')) {
      return (
        <pre className="markdown-code-block">
          <code>{text}</code>
        </pre>
      )
    }

    return <code className="markdown-inline-code">{children}</code>
  },
  hr: () => <hr />,
  table: ({ children }) => (
    <div className="markdown-table-wrap">
      <table>{children}</table>
    </div>
  ),
}

export function MarkdownDocument({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div className={['markdown-document', className].filter(Boolean).join(' ')}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
