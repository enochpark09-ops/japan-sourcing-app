"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface Item {
  id: string;
  nameJa: string;
  nameKoDraft: string;
  nameKoFinal: string | null;
  quantity: number;
  unitPrice: string;
  amount: string;
  confirmed: boolean;
}

interface Receipt {
  id: string;
  imageUrl: string;
  status: string;
  createdAt: string;
  items: Item[];
}

interface Shipment {
  id: string;
  name: string;
  createdAt: string;
  receipts: Receipt[];
}

export default function ShipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const shipmentId = params.id;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch(`/api/shipments/${shipmentId}`);
    const data = await res.json();
    if (res.ok) setShipment(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/shipments/${shipmentId}/receipts`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`"${file.name}" 처리 실패: ${data.error || "알 수 없는 오류"}`);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await load();
  }

  async function downloadDoc(type: string, label: string) {
    setDownloading(type);
    setError("");
    const res = await fetch(`/api/shipments/${shipmentId}/documents?type=${type}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "서류 생성에 실패했습니다.");
      setDownloading(null);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label}-${shipment?.name || "shipment"}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(null);
  }

  if (loading) return <div className="container"><div className="empty">불러오는 중...</div></div>;
  if (!shipment) return <div className="container"><div className="empty">사입 건을 찾을 수 없습니다.</div></div>;

  const allItems = shipment.receipts.flatMap((r) => r.items);
  const confirmedCount = allItems.filter((i) => i.confirmed).length;

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>{shipment.name}</h1>
          <div className="sub">
            품목 {allItems.length}개 중 <strong>{confirmedCount}개 컨펌 완료</strong>
          </div>
        </div>
        <a href="/"><button className="btn btn-sm">← 목록으로</button></a>
      </div>

      <div className="card">
        <div className="row-between">
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>영수증 업로드</div>
            <div className="muted" style={{ fontSize: 13 }}>
              사진을 올리면 OCR로 품목을 인식하고 한글 초안을 자동 번역합니다.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "인식 중..." : "+ 영수증 사진 추가"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
        <div className="note">
          ⚠️ 한글 품목명은 자동 번역된 <strong>초안</strong>입니다. 서류에 반영되려면 각 품목을
          확인하고 <strong>컨펌</strong> 버튼을 눌러야 합니다.
        </div>
        {error && <div className="error-box" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      {shipment.receipts.length === 0 && (
        <div className="card"><div className="empty">아직 업로드된 영수증이 없습니다.</div></div>
      )}

      {shipment.receipts.map((receipt) => (
        <ReceiptCard key={receipt.id} receipt={receipt} onChanged={load} />
      ))}

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 10 }}>서류 다운로드 (컨펌된 품목만 포함)</div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn" disabled={downloading !== null} onClick={() => downloadDoc("packing-list", "패킹리스트")}>
            {downloading === "packing-list" ? "생성 중..." : "패킹리스트 다운로드"}
          </button>
          <button className="btn" disabled={downloading !== null} onClick={() => downloadDoc("invoice", "상업송장")}>
            {downloading === "invoice" ? "생성 중..." : "상업송장 다운로드"}
          </button>
          <button className="btn" disabled={downloading !== null} onClick={() => downloadDoc("customs", "목록통관간이서류")}>
            {downloading === "customs" ? "생성 중..." : "목록통관용 간이서류 다운로드"}
          </button>
        </div>
        <div className="note">
          목록통관용 간이서류는 참고용입니다. 실제 수입통관 신고는 특송업체 또는 관세사를 통해
          진행해주세요. (본 앱은 법률/통관 자문을 제공하지 않습니다.)
        </div>
      </div>
    </div>
  );
}

function ReceiptCard({ receipt, onChanged }: { receipt: Receipt; onChanged: () => void }) {
  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <div className="row">
          {receipt.imageUrl && (
            <a href={receipt.imageUrl} target="_blank" rel="noreferrer">
              <img src={receipt.imageUrl} alt="receipt" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
            </a>
          )}
          <span className={`badge ${receipt.status === "confirmed" ? "badge-confirmed" : "badge-pending"}`}>
            {receipt.status === "confirmed" ? "컨펌 완료" : "확인 대기"}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            {new Date(receipt.createdAt).toLocaleString("ko-KR")}
          </span>
        </div>
      </div>

      {receipt.items.length === 0 ? (
        <div className="empty">품목을 인식하지 못했습니다. 사진을 다시 찍어 업로드해보세요.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 130 }}>원문(일본어)</th>
                <th style={{ minWidth: 130 }}>한글 품목명</th>
                <th style={{ minWidth: 64 }}>수량</th>
                <th style={{ minWidth: 90 }}>단가(¥)</th>
                <th style={{ minWidth: 90 }}>금액(¥)</th>
                <th style={{ minWidth: 90 }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item) => (
                <ItemRow key={item.id} receiptId={receipt.id} item={item} onChanged={onChanged} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  receiptId,
  item,
  onChanged,
}: {
  receiptId: string;
  item: Item;
  onChanged: () => void;
}) {
  const [nameKo, setNameKo] = useState(item.nameKoFinal || item.nameKoDraft || "");
  const [quantity, setQuantity] = useState(item.quantity);
  const [unitPrice, setUnitPrice] = useState(Number(item.unitPrice));
  const [amount, setAmount] = useState(Number(item.amount));
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState("");

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setRowError("");
    const res = await fetch(`/api/receipts/${receiptId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setRowError(data.error || "저장 실패");
      return false;
    }
    return true;
  }

  async function handleConfirm() {
    const ok = await patch({ nameKoFinal: nameKo, quantity, unitPrice, amount, confirmed: true });
    if (ok) onChanged();
  }

  async function handleEditAgain() {
    const ok = await patch({ confirmed: false });
    if (ok) onChanged();
  }

  return (
    <tr>
      <td className="muted" style={{ minWidth: 130 }}>{item.nameJa}</td>
      <td style={{ minWidth: 130 }}>
        {item.confirmed ? (
          <span>{item.nameKoFinal}</span>
        ) : (
          <input className="wide-input" type="text" value={nameKo} onChange={(e) => setNameKo(e.target.value)} placeholder="한글 품목명" />
        )}
      </td>
      <td style={{ minWidth: 64 }}>
        {item.confirmed ? (
          item.quantity
        ) : (
          <input className="num-input" type="number" value={quantity} min={1} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
        )}
      </td>
      <td style={{ minWidth: 90 }}>
        {item.confirmed ? (
          Number(item.unitPrice).toLocaleString()
        ) : (
          <input className="num-input" type="number" value={unitPrice} onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)} />
        )}
      </td>
      <td style={{ minWidth: 90 }}>
        {item.confirmed ? (
          Number(item.amount).toLocaleString()
        ) : (
          <input className="num-input" type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
        )}
      </td>
      <td>
        {item.confirmed ? (
          <button className="btn btn-sm" onClick={handleEditAgain} disabled={saving}>
            수정
          </button>
        ) : (
          <button className="btn btn-sm btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? "저장 중" : "컨펌"}
          </button>
        )}
        {rowError && <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 4 }}>{rowError}</div>}
      </td>
    </tr>
  );
}
