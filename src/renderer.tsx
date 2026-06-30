import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html>
      <head>
        <link rel="icon" type="image/svg+xml" href="/static/brand/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/static/brand/favicon-32.png" />
        <link rel="apple-touch-icon" href="/static/brand/favicon-180.png" />
        <link href="/static/style.css" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
})
