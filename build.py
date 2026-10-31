"""Собирает игру из src/ в dist/tumanny-krai.html.

    python3 build.py

Порядок: src/head.html, src/style.css, src/body.html, затем все src/*.js по имени файла.
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'dist', 'tumanny-krai.html')


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8', newline='') as f:
        return f.read().replace('\r\n', '\n').strip()


def build():
    js = sorted(n for n in os.listdir(SRC) if n.endswith('.js'))
    html = (read('head.html') + '\n' + read('style.css') + '\n</style>\n</head>\n<body>\n' + read('body.html') +
            '\n\n<script>\n' + '\n\n'.join(read(n) for n in js) + '\n\n</script>\n</body>\n</html>\n')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='') as f:
        f.write(html)
    print('%s: %d KB, %d js modules' % (os.path.relpath(OUT, ROOT), len(html.encode('utf-8')) // 1024, len(js)))


if __name__ == '__main__':
    build()
