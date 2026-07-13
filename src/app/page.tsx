"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ShipmentListItem {
  id: string;
  name: string;
  createdAt: string;
  receipts: { id: string; status: string; items: { confirmed: boolean }[] }[];
}

export default function HomePage() {
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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
            return (
              <div className="shipment-item" key={s.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    영수증 {s.receipts.length}건 · 품목 {allItems.length}개 중 컨펌 {confirmedCount}개
                    · {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
                <Link href={`/shipments/${s.id}`}>
                  <button className="btn">열기</button>
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
