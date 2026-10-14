/**
 * Generator script: Converts PROJECT_DOCUMENTATION.docs into a styled Microsoft Word (.docx) document
 */
const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType
} = require('../backend/node_modules/docx');

const DOCS_PATH = path.join(__dirname, '..', 'PROJECT_DOCUMENTATION.md');
const OUTPUT_DOCX = path.join(__dirname, '..', 'PROJECT_DOCUMENTATION.docx');

function parseMarkdownToDocx(mdContent) {
  const lines = mdContent.split(/\r?\n/);
  const children = [];

  let inCodeBlock = false;
  let codeBuffer = [];
  let inTable = false;
  let tableRows = [];

  function flushCodeBlock() {
    if (codeBuffer.length === 0) return;
    const codeText = codeBuffer.join('\n');
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: codeText,
            font: 'Consolas',
            size: 18, // 9pt
            color: '1E293B'
          })
        ],
        shading: {
          type: ShadingType.CLEAR,
          fill: 'F1F5F9'
        },
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          left: { style: BorderStyle.SINGLE, size: 12, color: '2563EB' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }
        },
        spacing: { before: 120, after: 120 },
        indent: { left: 180, right: 180 }
      })
    );
    codeBuffer = [];
  }

  function flushTable() {
    if (tableRows.length === 0) return;

    // Filter out separator rows like |---|---|
    const validRows = tableRows.filter(row => !row.every(cell => /^[-:\s]+$/.test(cell)));
    if (validRows.length === 0) {
      tableRows = [];
      return;
    }

    const docxRows = validRows.map((rowCells, rIdx) => {
      const isHeader = rIdx === 0;
      return new TableRow({
        tableHeader: isHeader,
        children: rowCells.map(cellText => {
          return new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cellText.trim(),
                    bold: isHeader,
                    size: isHeader ? 19 : 18,
                    font: 'Segoe UI',
                    color: isHeader ? '0F172A' : '334155'
                  })
                ],
                spacing: { before: 80, after: 80 }
              })
            ],
            shading: {
              type: ShadingType.CLEAR,
              fill: isHeader ? 'E2E8F0' : (rIdx % 2 === 0 ? 'F8FAFC' : 'FFFFFF')
            },
            margins: {
              top: 100,
              bottom: 100,
              left: 140,
              right: 140
            },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
              left: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
              right: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }
            }
          });
        })
      });
    });

    children.push(
      new Table({
        rows: docxRows,
        width: {
          size: 100,
          type: WidthType.PERCENTAGE
        }
      })
    );

    children.push(new Paragraph({ spacing: { after: 140 } }));
    tableRows = [];
  }

  function parseFormattedRuns(text) {
    const runs = [];
    // Tokenize bold, code, and plain text
    const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        runs.push(
          new TextRun({
            text: text.substring(lastIndex, match.index),
            font: 'Segoe UI',
            size: 21,
            color: '1E293B'
          })
        );
      }

      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        runs.push(
          new TextRun({
            text: token.slice(2, -2),
            bold: true,
            font: 'Segoe UI',
            size: 21,
            color: '0F172A'
          })
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        runs.push(
          new TextRun({
            text: token.slice(1, -1),
            font: 'Consolas',
            size: 19,
            color: '1D4ED8'
          })
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        runs.push(
          new TextRun({
            text: token.slice(1, -1),
            italics: true,
            font: 'Segoe UI',
            size: 21,
            color: '475569'
          })
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      runs.push(
        new TextRun({
          text: text.substring(lastIndex),
          font: 'Segoe UI',
          size: 21,
          color: '1E293B'
        })
      );
    }

    return runs.length > 0 ? runs : [new TextRun({ text, font: 'Segoe UI', size: 21, color: '1E293B' })];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        if (inTable) {
          flushTable();
          inTable = false;
        }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Table line
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      const rawCells = line.split('|').slice(1, -1);
      tableRows.push(rawCells.map(c => c.trim()));
      continue;
    } else if (inTable) {
      flushTable();
      inTable = false;
    }

    const trimmed = line.trim();

    // Empty lines
    if (!trimmed) {
      continue;
    }

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***') {
      children.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E2E8F0' }
          },
          spacing: { before: 140, after: 180 }
        })
      );
      continue;
    }

    // Title / H1
    if (trimmed.startsWith('# ')) {
      children.push(
        new Paragraph({
          text: trimmed.replace(/^#\s+/, ''),
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.LEFT,
          spacing: { before: 240, after: 140 }
        })
      );
      continue;
    }

    // H2
    if (trimmed.startsWith('## ')) {
      children.push(
        new Paragraph({
          text: trimmed.replace(/^##\s+/, ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 120 }
        })
      );
      continue;
    }

    // H3
    if (trimmed.startsWith('### ')) {
      children.push(
        new Paragraph({
          text: trimmed.replace(/^###\s+/, ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 }
        })
      );
      continue;
    }

    // H4
    if (trimmed.startsWith('#### ')) {
      children.push(
        new Paragraph({
          text: trimmed.replace(/^####\s+/, ''),
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 160, after: 80 }
        })
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      const quoteText = trimmed.replace(/^>\s+/, '');
      children.push(
        new Paragraph({
          children: parseFormattedRuns(quoteText),
          border: {
            left: { style: BorderStyle.SINGLE, size: 14, color: '2563EB' }
          },
          shading: {
            type: ShadingType.CLEAR,
            fill: 'F0F7FF'
          },
          indent: { left: 240 },
          spacing: { before: 80, after: 80 }
        })
      );
      continue;
    }

    // Bullet List
    if (/^[-*]\s+/.test(trimmed)) {
      const listContent = trimmed.replace(/^[-*]\s+/, '');
      children.push(
        new Paragraph({
          children: parseFormattedRuns(listContent),
          bullet: { level: 0 },
          spacing: { before: 40, after: 40 }
        })
      );
      continue;
    }

    // Numbered List
    if (/^\d+\.\s+/.test(trimmed)) {
      const listContent = trimmed.replace(/^\d+\.\s+/, '');
      children.push(
        new Paragraph({
          children: parseFormattedRuns(listContent),
          numbering: { reference: 'default-num', level: 0 },
          spacing: { before: 40, after: 40 }
        })
      );
      continue;
    }

    // Standard body paragraph
    children.push(
      new Paragraph({
        children: parseFormattedRuns(trimmed),
        spacing: { before: 60, after: 60 },
        lineSpacing: 276 // 1.15 line height
      })
    );
  }

  if (inCodeBlock) flushCodeBlock();
  if (inTable) flushTable();

  return children;
}

async function generateDocx() {
  console.log(`Reading source document: ${DOCS_PATH}`);
  const mdContent = fs.readFileSync(DOCS_PATH, 'utf-8');

  console.log('Parsing markdown elements into Word OpenXML schema...');
  const children = parseMarkdownToDocx(mdContent);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Segoe UI',
            size: 21, // 10.5pt
            color: '1E293B'
          }
        }
      },
      heading1: {
        run: {
          font: 'Segoe UI',
          size: 38, // 19pt
          bold: true,
          color: '1E40AF'
        },
        paragraph: {
          spacing: { before: 240, after: 140 }
        }
      },
      heading2: {
        run: {
          font: 'Segoe UI',
          size: 30, // 15pt
          bold: true,
          color: '1E3A8A'
        },
        paragraph: {
          spacing: { before: 260, after: 120 }
        }
      },
      heading3: {
        run: {
          font: 'Segoe UI',
          size: 25, // 12.5pt
          bold: true,
          color: '2563EB'
        },
        paragraph: {
          spacing: { before: 180, after: 90 }
        }
      },
      heading4: {
        run: {
          font: 'Segoe UI',
          size: 22, // 11pt
          bold: true,
          color: '0F172A'
        },
        paragraph: {
          spacing: { before: 140, after: 70 }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        children: children
      }
    ]
  });

  console.log('Compiling .docx binary package...');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT_DOCX, buffer);

  const stats = fs.statSync(OUTPUT_DOCX);
  console.log(`\nSUCCESS! Created Microsoft Word Document:`);
  console.log(`Path: ${OUTPUT_DOCX}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`);
}

generateDocx().catch(err => {
  console.error('Error generating .docx file:', err);
  process.exit(1);
});
