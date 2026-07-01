'use client';

import { Bill } from './bills-view';

interface InvoicePreviewProps {
  bill: Bill;
  onClose: () => void;
}

export default function InvoicePreview({ bill, onClose }: InvoicePreviewProps) {
  const isGST = bill.billType === 'gst';
  const invoiceNo = `ATS/${new Date(bill.date).getFullYear().toString().slice(2)}-${String(new Date(bill.date).getMonth() + 1).padStart(2, '0')}/${bill.billNumber.replace(/\D/g, '').padStart(3, '0')}`;
  const invoiceDate = new Date(bill.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Calculate totals for GST bill
  const totalCgst = bill.items.reduce((sum, item) => sum + (item.cgst || 0), 0);
  const totalSgst = bill.items.reduce((sum, item) => sum + (item.sgst || 0), 0);
  const taxableAmount = bill.items.reduce((sum, item) => sum + ((item.baseRate || item.rate) * item.quantity), 0);

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-start justify-center overflow-y-auto py-4">
      <div className="relative w-full max-w-[850px] mx-4">
        {/* Close button - no-print */}
        <div className="no-print flex justify-end mb-2">
          <button
            onClick={onClose}
            className="bg-white text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg shadow text-sm font-medium"
          >
            ✕ Close
          </button>
        </div>

        {/* Invoice Box */}
        <div className="bg-white border border-gray-300 shadow-lg p-8 md:p-10" style={{ fontFamily: 'Arial, sans-serif', fontSize: '13px' }}>
          {/* Company Header */}
          <div className="border-b-2 border-black pb-3 mb-5 flex justify-between">
            <div>
              <h2 style={{ color: '#0056b3', fontWeight: 'bold', fontSize: '26px', marginBottom: '4px' }}>
                AAROHAN TECH SOLUTIONS
              </h2>
              <p className="mb-0">ADDRESS: 24/27 A.K.M ROAD, BARANAGAR, KOLKATA - 700090</p>
              <p className="mb-0">CONTACT NO: 6290717007 | MAIL: contact@aarohantechsolutions.in</p>
              <p className="mb-0 uppercase">REG ID: UDYAM-WB-14-0251483 | <strong>GST NO: 19MKIPS8902F1ZG</strong></p>
            </div>
            <div className="text-right">
              <h3 className="text-gray-500 text-xl font-semibold">{isGST ? 'TAX INVOICE' : 'INVOICE'}</h3>
              <p>Invoice No: {invoiceNo}<br />Date: {invoiceDate}</p>
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-5">
            <strong>Bill To:</strong><br />
            Name: {bill.client.name.toUpperCase()}<br />
            {bill.clientAddress || bill.client.address ? `Address: ${bill.clientAddress || bill.client.address}<br />` : ''}
            Mobile: {bill.client.phone}<br />
            {isGST && bill.clientGst && <span>GSTIN: {bill.clientGst.toUpperCase()}<br /></span>}
          </div>

          {/* Items Table */}
          <table className="w-full border-collapse border border-gray-300 mb-4">
            <thead>
              <tr className="bg-gray-100 text-center">
                <th className="border border-gray-300 px-3 py-2">Item</th>
                <th className="border border-gray-300 px-3 py-2">Description</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Rate</th>
                <th className="border border-gray-300 px-3 py-2 text-center">Qty</th>
                {isGST && <th className="border border-gray-300 px-3 py-2 text-right">GST (18%)</th>}
                <th className="border border-gray-300 px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item, i) => (
                <tr key={i}>
                  <td className="border border-gray-300 px-3 py-2">{item.itemName || item.description}</td>
                  <td className="border border-gray-300 px-3 py-2">{item.description}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">{fmt(item.baseRate || item.rate)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{item.quantity}</td>
                  {isGST && (
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {fmt((item.cgst || 0) + (item.sgst || 0))}
                    </td>
                  )}
                  <td className="border border-gray-300 px-3 py-2 text-right">{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Section */}
          <div className="flex justify-between mt-4">
            {/* Bank Details */}
            <div>
              <div style={{ marginTop: '10px', padding: '10px', border: '1px dashed #0056b3', background: '#f0f7ff', display: 'inline-block', minWidth: '300px' }}>
                <strong>BANK DETAILS:</strong><br />
                BANK NAME: SAMATA CO-OPERATIVE BANK<br />
                ACC NO: 003105000000153<br />
                IFSC CODE: HDFC0CSAMAT
              </div>
            </div>

            {/* Amount Summary */}
            <div>
              <table className="border-collapse border border-gray-300 text-sm">
                {isGST ? (
                  <>
                    <tr><td className="border border-gray-300 px-3 py-1">Taxable Amount:</td><td className="border border-gray-300 px-3 py-1 text-right">{fmt(taxableAmount)}</td></tr>
                    <tr><td className="border border-gray-300 px-3 py-1">CGST (9%):</td><td className="border border-gray-300 px-3 py-1 text-right">{fmt(totalCgst)}</td></tr>
                    <tr><td className="border border-gray-300 px-3 py-1">SGST (9%):</td><td className="border border-gray-300 px-3 py-1 text-right">{fmt(totalSgst)}</td></tr>
                  </>
                ) : (
                  <>
                    <tr><td className="border border-gray-300 px-3 py-1">Subtotal:</td><td className="border border-gray-300 px-3 py-1 text-right">{fmt(bill.subtotal)}</td></tr>
                    {bill.discount > 0 && (
                      <tr><td className="border border-gray-300 px-3 py-1">Discount:</td><td className="border border-gray-300 px-3 py-1 text-right">-{fmt(bill.discount)}</td></tr>
                    )}
                  </>
                )}
                <tr className="bg-gray-800 text-white">
                  <td className="border border-gray-300 px-3 py-1"><strong>Grand Total:</strong></td>
                  <td className="border border-gray-300 px-3 py-1 text-right"><strong>{fmt(bill.total)}</strong></td>
                </tr>
              </table>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div style={{ fontSize: '11px', marginTop: '25px', lineHeight: '1.5', borderTop: '1px solid #eee', paddingTop: '15px', textAlign: 'justify' as const }}>
            <strong>Terms &amp; Conditions:</strong><br />
            <strong>a) Payment Terms:</strong> 100% payment must be made at the time of invoice generation or before the commencement of services.<br />
            <strong>b) Scope of Work:</strong> This invoice covers only the agreed marketing services (such as Digital Marketing, Social Media Management, SEO, Paid Ads, etc.). Any additional work outside the agreed scope will be charged separately.<br />
            <strong>c) GST &amp; Taxes:</strong> Applicable GST (CGST/SGST/IGST) has been charged as per Goods and Services Tax regulations. The client must provide a valid GSTIN to claim input tax credit.<br />
            <strong>d) No Guarantee Clause:</strong> Marketing results such as leads, conversions, or sales are not guaranteed. Performance may vary based on market conditions, competition, budget, and audience behavior.<br />
            <strong>e) Advertising Spend:</strong> Any advertising budget (Google Ads, Meta Ads, etc.) is not included in this invoice unless explicitly mentioned. Ad spend will be borne by the client.<br />
            <strong>f) Refund Policy:</strong> All payments made are non-refundable once the service has commenced. Advance payments are strictly non-refundable.<br />
            <strong>g) Client Responsibilities:</strong> The client must provide all required access (such as ad accounts, website, social media accounts, etc.) in a timely manner. Delays due to lack of access will not be the agency&apos;s responsibility.<br />
            <strong>h) Delays &amp; Non-Cooperation:</strong> Any delay from the client&apos;s side will result in an extension of the project timeline. Continuous non-response may lead to temporary suspension of services.<br />
            <strong>i) Intellectual Property:</strong> All deliverables (creatives, content, designs, etc.) will remain the property of the agency until full payment is received. Ownership will be transferred to the client only after complete payment.<br />
            <strong>j) Termination:</strong> Either party may terminate the agreement by providing 7 days&apos; prior written notice. Payment for all completed work must be cleared.<br />
            <strong>k) Jurisdiction:</strong> All disputes shall be subject to the jurisdiction of Kolkata, West Bengal.
          </div>

          {/* Footer */}
          <div style={{ fontSize: '10px', fontStyle: 'italic', marginTop: '20px', textAlign: 'center', color: '#555' }}>
            &ldquo;This is a system-generated invoice. Subject to AAROHAN TECH SOLUTIONS Terms &amp; Conditions.&rdquo;
          </div>

          {/* Print Button - no-print */}
          <div className="no-print mt-6 text-center pb-5">
            <button
              onClick={() => window.print()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-3 rounded shadow-md font-semibold transition-colors"
            >
              DOWNLOAD / PRINT INVOICE
            </button>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .fixed { position: static !important; }
          .bg-black\\/50 { background: none !important; }
        }
      `}</style>
    </div>
  );
}
