import jsPDF from 'jspdf'

export function buildPdfSummary({ sections, scorecard }) {
  const doc = new jsPDF({ unit: 'pt' })
  const margin = 40
  const pageHeight = doc.internal.pageSize.getHeight()
  const lineHeight = 16
  let y = margin

  function ensureSpace(extra) {
    if (y + extra > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  function writeLine(text, { size = 11, bold = false, gap = lineHeight } = {}) {
    ensureSpace(gap)
    doc.setFontSize(size)
    doc.setFont(undefined, bold ? 'bold' : 'normal')
    doc.text(text, margin, y)
    y += gap
  }

  writeLine('M5 Health -- Shared Health Summary', { size: 16, bold: true, gap: 24 })
  writeLine(`Generated ${new Date().toLocaleString()}`, { size: 9, gap: 20 })

  if (scorecard) {
    writeLine('PIQI Data Readiness Summary (data quality, not a health score)', {
      size: 12,
      bold: true,
      gap: 18,
    })
    writeLine(`Overall Readiness: ${Math.round(scorecard.overall * 100)}%`, { gap: 16 })
    for (const [dimension, value] of Object.entries(scorecard.dimensionScores)) {
      writeLine(`  ${dimension}: ${Math.round(value * 100)}%`, { size: 10, gap: 14 })
    }
    y += 8
  }

  for (const section of sections) {
    ensureSpace(24)
    writeLine(section.label, { size: 13, bold: true, gap: 18 })
    if (section.records.length === 0) {
      writeLine('  No records.', { size: 10, gap: 14 })
    }
    for (const record of section.records) {
      writeLine(`  ${record.title}`, { size: 11, bold: true, gap: 15 })
      for (const line of record.lines) {
        writeLine(`    ${line}`, { size: 10, gap: 13 })
      }
      writeLine(`    Source: ${record.source}`, { size: 9, gap: 13 })
    }
    y += 6
  }

  return doc.output('blob')
}
