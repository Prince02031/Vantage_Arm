// Dashboard.jsx
// Live operator dashboard — operator profile, live joint panel, EEF coordinates.
import React from 'react';
import JointPanel from './JointPanel.jsx';

const OPERATORS = [
    { name: 'Nafisa Rahman', email: 'nafisa.rahman@yahoo.com', phone: '+8801812345678' },
    { name: 'Tanvir Hossain', email: 'tanvir.hossain@yahoo.com', phone: '+8801912345678' },
];

function fmt(v, d = 3) {
    return v == null ? '--' : (+v).toFixed(d);
}

export default function Dashboard({ joints = {}, eef, limits = {}, operatorIdx, onOperatorChange }) {
    const op = OPERATORS[operatorIdx % 2];
    return (
        <aside className="dashboard">

            {/* ── Operator ── */}
            <section className="db-section">
                <h2 className="db-title">Operator</h2>
                <div className="db-card">
                    <p className="db-op-name">{op.name}</p>
                    <p className="db-op-sub">{op.email}</p>
                    <p className="db-op-sub">{op.phone}</p>
                    <button className="db-btn" onClick={() => onOperatorChange((operatorIdx + 1) % 2)}>
                        Switch Operator
                    </button>
                </div>
            </section>

            {/* ── Joint States (embedded JointPanel) ── */}
            <section className="db-section">
                <h2 className="db-title">Joint States</h2>
                <JointPanel joints={joints} limits={limits} />
            </section>

            {/* ── Stylus TCP ── */}
            <section className="db-section">
                <h2 className="db-title">Stylus TCP</h2>
                <div className="db-card db-eef">
                    <div className="db-eef-row">
                        <span className="db-eef-axis">X</span>
                        <span className="db-eef-val">{fmt(eef?.x)} m</span>
                    </div>
                    <div className="db-eef-row">
                        <span className="db-eef-axis">Y</span>
                        <span className="db-eef-val">{fmt(eef?.y)} m</span>
                    </div>
                    <div className="db-eef-row">
                        <span className="db-eef-axis">Z</span>
                        <span className="db-eef-val">{fmt(eef?.z)} m</span>
                    </div>
                </div>
            </section>

        </aside>
    );
}
