const fs = require('fs');

function escapeBackticks(str) {
  return str.replace(/`/g, '\\`').replace(/\\/g, '\\\\').replace(/\$/g, '\\$');
}

function compile(template) {
  let src = "let __output=''; const __escape=(val)=>val==null?'':val; with(locals){";
  let cursor = 0;
  const regex = /<%([-=]?)([\s\S]*?)%>/g;
  let match;
  while ((match = regex.exec(template)) !== null) {
    const [full, flag, code] = match;
    const text = template.slice(cursor, match.index);
    if (text) {
      src += `__output+=\`${escapeBackticks(text).replace(/\r|\n/g, '\\n')}\`;`;
    }
    if (flag === '=') {
      src += `__output+=__escape(${code});`;
    } else if (flag === '-') {
      src += `__output+=(${code});`;
    } else {
      src += `${code}`;
    }
    cursor = match.index + full.length;
  }
  const tail = template.slice(cursor);
  if (tail) {
    src += `__output+=\`${escapeBackticks(tail).replace(/\r|\n/g, '\\n')}\`;`;
  }
  src += ' } return __output;';
  return new Function('locals', src);
}

function render(template, data) {
  const fn = compile(template);
  return fn(data || {});
}

function renderFile(filePath, data, cb) {
  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) return cb(err);
    try {
      const result = render(content, data);
      cb(null, result);
    } catch (error) {
      cb(error);
    }
  });
}

module.exports = {
  __express: renderFile,
  render,
  renderFile,
  compile,
};
