import sys,re,html
h=open(sys.argv[1],encoding='utf8',errors='replace').read()
h=re.sub(r'<(script|style|svg|noscript)[^>]*>.*?</\1>','',h,flags=re.S|re.I)
h=re.sub(r'<br\s*/?>|</p>|</div>|</li>|</h[1-6]>|</tr>','\n',h,flags=re.I)
t=html.unescape(re.sub(r'<[^>]+>','',h))
t=re.sub(r'[ \t\xa0]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t)
print(t.strip())
