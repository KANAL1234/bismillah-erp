import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// ============================================================================
// EXCEL EXPORT UTILITIES
// ============================================================================

export interface ExcelColumn {
    header: string
    key: string
    width?: number
}

export interface ExcelExportOptions {
    filename: string
    sheetName?: string
    title?: string
    subtitle?: string
    columns: ExcelColumn[]
    data: any[]
    summary?: { label: string; value: string | number }[]
}

export function exportToExcel(options: ExcelExportOptions) {
    const {
        filename,
        sheetName = 'Sheet1',
        title,
        subtitle,
        columns,
        data,
        summary,
    } = options

    const wb = XLSX.utils.book_new()
    const wsData: any[][] = []

    // Add title
    if (title) {
        wsData.push([title])
        wsData.push([])
    }

    // Add subtitle
    if (subtitle) {
        wsData.push([subtitle])
        wsData.push([])
    }

    // Add headers
    wsData.push(columns.map((col) => col.header))

    // Add data rows
    data.forEach((row) => {
        wsData.push(columns.map((col) => row[col.key] ?? ''))
    })

    // Add summary
    if (summary && summary.length > 0) {
        wsData.push([])
        wsData.push(['SUMMARY'])
        summary.forEach((item) => {
            wsData.push([item.label, item.value])
        })
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Set column widths
    ws['!cols'] = columns.map((col) => ({ wch: col.width || 15 }))

    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ============================================================================
// PDF EXPORT UTILITIES
// ============================================================================

export interface PDFColumn {
    header: string
    dataKey: string
}

export interface PDFExportOptions {
    filename: string
    title: string
    subtitle?: string
    columns: PDFColumn[]
    data: any[]
    orientation?: 'portrait' | 'landscape'
    footer?: string
}

export function exportToPDF(options: PDFExportOptions) {
    const {
        filename,
        title,
        subtitle,
        columns,
        data,
        orientation = 'portrait',
        footer,
    } = options

    const doc = new jsPDF(orientation)

    // Add title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(title, 14, 20)

    // Add subtitle
    if (subtitle) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text(subtitle, 14, 28)
    }

    // Add table
    ; (doc as any).autoTable({
        startY: subtitle ? 35 : 28,
        head: [columns.map((col) => col.header)],
        body: data.map((row) => columns.map((col) => row[col.dataKey] ?? '')),
        theme: 'grid',
        headStyles: {
            fillColor: [71, 85, 105], // slate-600
            textColor: 255,
            fontStyle: 'bold',
        },
        styles: {
            fontSize: 9,
            cellPadding: 3,
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252], // slate-50
        },
    })

    // Add footer
    if (footer) {
        const pageCount = (doc as any).internal.getNumberOfPages()
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i)
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            doc.text(
                footer,
                doc.internal.pageSize.getWidth() / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            )
        }
    }

    doc.save(`${filename}.pdf`)
}

// ============================================================================
// INVOICE PDF GENERATION
// ============================================================================

export interface InvoiceData {
    invoice_number: string
    invoice_date: string
    due_date?: string
    customer_name: string
    customer_address?: string
    items: {
        description: string
        quantity: number
        unit_price: number
        amount: number
    }[]
    subtotal: number
    tax_amount: number
    total_amount: number
    notes?: string
}

export function generateInvoicePDF(invoice: InvoiceData, companyInfo?: {
    name: string
    address?: string
    phone?: string
    email?: string
}) {
    const doc = new jsPDF()

    // Company Header
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(companyInfo?.name || 'Company Name', 14, 20)

    if (companyInfo?.address) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(companyInfo.address, 14, 27)
    }

    // Invoice Title
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', 150, 20)

    // Invoice Details
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Invoice #: ${invoice.invoice_number}`, 150, 30)
    doc.text(`Date: ${invoice.invoice_date}`, 150, 36)
    if (invoice.due_date) {
        doc.text(`Due Date: ${invoice.due_date}`, 150, 42)
    }

    // Customer Details
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Bill To:', 14, 50)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(invoice.customer_name, 14, 57)
    if (invoice.customer_address) {
        doc.text(invoice.customer_address, 14, 63)
    }

    // Items Table
    ; (doc as any).autoTable({
        startY: 75,
        head: [['Description', 'Qty', 'Unit Price', 'Amount']],
        body: invoice.items.map((item) => [
            item.description,
            item.quantity,
            `Rs. ${item.unit_price.toLocaleString()}`,
            `Rs. ${item.amount.toLocaleString()}`,
        ]),
        theme: 'grid',
        headStyles: {
            fillColor: [71, 85, 105],
            textColor: 255,
            fontStyle: 'bold',
        },
        columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 35, halign: 'right' },
        },
    })

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(10)
    doc.text('Subtotal:', 140, finalY)
    doc.text(`Rs. ${invoice.subtotal.toLocaleString()}`, 180, finalY, { align: 'right' })

    doc.text('Tax:', 140, finalY + 6)
    doc.text(`Rs. ${invoice.tax_amount.toLocaleString()}`, 180, finalY + 6, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Total:', 140, finalY + 14)
    doc.text(`Rs. ${invoice.total_amount.toLocaleString()}`, 180, finalY + 14, { align: 'right' })

    // Notes
    if (invoice.notes) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text('Notes:', 14, finalY + 25)
        doc.text(invoice.notes, 14, finalY + 31, { maxWidth: 180 })
    }

    // Footer
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text(
        'Thank you for your business!',
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
    )

    doc.save(`Invoice_${invoice.invoice_number}.pdf`)
}

// ============================================================================
// PAYSLIP PDF GENERATION
// ============================================================================

export interface PayslipData {
    employee_name: string
    employee_code: string
    designation: string
    department: string
    pay_period: string
    basic_salary: number
    allowances: { name: string; amount: number }[]
    deductions: { name: string; amount: number }[]
    net_salary: number
}

export function generatePayslipPDF(payslip: PayslipData, companyInfo?: {
    name: string
    address?: string
}) {
    const doc = new jsPDF()

    // Company Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(companyInfo?.name || 'Company Name', 105, 20, { align: 'center' })

    if (companyInfo?.address) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(companyInfo.address, 105, 27, { align: 'center' })
    }

    // Payslip Title
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('SALARY SLIP', 105, 40, { align: 'center' })

    // Employee Details
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Employee: ${payslip.employee_name}`, 14, 55)
    doc.text(`Code: ${payslip.employee_code}`, 14, 61)
    doc.text(`Designation: ${payslip.designation}`, 14, 67)
    doc.text(`Department: ${payslip.department}`, 14, 73)
    doc.text(`Pay Period: ${payslip.pay_period}`, 140, 55)

    // Earnings Table
    const earningsData = [
        ['Basic Salary', `Rs. ${payslip.basic_salary.toLocaleString()}`],
        ...payslip.allowances.map((a) => [a.name, `Rs. ${a.amount.toLocaleString()}`]),
    ]

        ; (doc as any).autoTable({
            startY: 85,
            head: [['Earnings', 'Amount']],
            body: earningsData,
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105] },
            margin: { left: 14, right: 110 },
        })

    // Deductions Table
    const deductionsData = payslip.deductions.map((d) => [
        d.name,
        `Rs. ${d.amount.toLocaleString()}`,
    ])

        ; (doc as any).autoTable({
            startY: 85,
            head: [['Deductions', 'Amount']],
            body: deductionsData.length > 0 ? deductionsData : [['None', 'Rs. 0']],
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105] },
            margin: { left: 110, right: 14 },
        })

    // Net Salary
    const finalY = Math.max(
        (doc as any).previousAutoTable.finalY || 0,
        (doc as any).lastAutoTable.finalY || 0
    )

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Net Salary:', 14, finalY + 15)
    doc.text(`Rs. ${payslip.net_salary.toLocaleString()}`, 180, finalY + 15, { align: 'right' })

    // Footer
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text(
        'This is a computer-generated document. No signature required.',
        105,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
    )

    doc.save(`Payslip_${payslip.employee_code}_${payslip.pay_period.replace(' ', '_')}.pdf`)
}
