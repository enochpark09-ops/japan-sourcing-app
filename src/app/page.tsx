"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ShipmentListItem {
  id: string;
  name: string;
  createdAt: string;
  receipts: { id: string; status: string; items: { confirmed: boolean; amount: string }[] }[];
}

export default function HomePage() {
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/shipments");
    const data = await res.json();
    setShipments(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createShipment() {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error || "생성에 실패했습니다.");
      return;
    }
    setName("");
    await load();
  }

  async function handleDeleteShipment(id: string, name: string) {
    if (!window.confirm(`"${name}" 사입 건을 삭제할까요? 업로드된 영수증과 품목이 모두 함께 삭제되며 되돌릴 수 없습니다.`)) return;
    setDeletingId(id);
    setError("");
    const res = await fetch(`/api/shipments/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "삭제에 실패했습니다.");
      return;
    }
    await load();
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>일본 사입 서류 자동화</h1>
          <div className="sub">영수증 업로드 → 품목 확인/컨펌 → 패킹리스트 · 수입서류 생성</div>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <input
            type="text"
            placeholder="사입 건 이름 (예: 2026-07 오사카 사입)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createShipment()}
          />
          <button className="btn btn-primary" onClick={createShipment} disabled={creating}>
            {creating ? "생성 중..." : "새 사입 건 만들기"}
          </button>
        </div>
        {error && <div className="error-box" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty">불러오는 중...</div>
        ) : shipments.length === 0 ? (
          <div className="empty">아직 생성된 사입 건이 없습니다.</div>
        ) : (
          shipments.map((s) => {
            const allItems = s.receipts.flatMap((r) => r.items);
            const confirmedCount = allItems.filter((i) => i.confirmed).length;
            const totalAmount = allItems.reduce((sum, i) => sum + Number(i.amount), 0);
            return (
              <div className="shipment-item" key={s.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    영수증 {s.receipts.length}건 · 품목 {allItems.length}개 중 컨펌 {confirmedCount}개
                    · 구매액 합계 ¥{totalAmount.toLocaleString()}
                    · {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
                <div className="row">
                  <Link href={`/shipments/${s.id}`}>
                    <button className="btn">열기</button>
                  </Link>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDeleteShipment(s.id, s.name)}
                    disabled={deletingId === s.id}
                    title="사입 건 삭제"
                  >
                    {deletingId === s.id ? "삭제 중" : "삭제"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
