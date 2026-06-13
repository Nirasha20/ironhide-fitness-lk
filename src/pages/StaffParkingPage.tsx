import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PageWrapper } from '../components/layout/PageWrapper';

interface ParkingData { carCount: number; carCapacity: number; bikeCount: number; bikeCapacity: number; }

export default function StaffParkingPage() {
  const [parking, setParking] = useState<ParkingData>({ carCount: 0, carCapacity: 20, bikeCount: 0, bikeCapacity: 15 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, 'gym', 'parking'), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setParking({ carCount: d.carCount ?? 0, carCapacity: d.carCapacity ?? 20, bikeCount: d.bikeCount ?? 0, bikeCapacity: d.bikeCapacity ?? 15 });
      } else {
        setDoc(doc(db, 'gym', 'parking'), { carCount: 0, carCapacity: 20, bikeCount: 0, bikeCapacity: 15 });
      }
    });
  }, []);

  const update = async (field: 'carCount' | 'bikeCount', delta: number) => {
    const current = parking[field];
    const capacity = field === 'carCount' ? parking.carCapacity : parking.bikeCapacity;
    const next = Math.max(0, Math.min(capacity, current + delta));
    if (next === current) return;
    setSaving(true);
    await updateDoc(doc(db, 'gym', 'parking'), { [field]: next }).finally(() => setSaving(false));
  };

  const CounterControl = ({ label, count, capacity, onInc, onDec }: { label: string; count: number; capacity: number; onInc: () => void; onDec: () => void }) => (
    <div className="bg-surface-container border-t-2 border-primary-container p-8 space-y-6">
      <h3 className="font-display text-headline-md uppercase">{label}</h3>
      <div className="font-display text-[72px] leading-none text-center">{count}<span className="text-on-surface-variant text-headline-lg">/{capacity}</span></div>
      <div className="flex gap-4 justify-center">
        <button onClick={onDec} disabled={count === 0 || saving}
          className="w-16 h-16 border-2 border-border-default text-headline-lg font-display hover:border-primary-container disabled:opacity-30 transition-all">−</button>
        <button onClick={onInc} disabled={count >= capacity || saving}
          className="w-16 h-16 bg-primary-container text-on-primary-container text-headline-lg font-display hover:scale-105 disabled:opacity-30 transition-all">+</button>
      </div>
      <p className="text-center font-body text-body-md text-on-surface-variant">{capacity - count} spaces available</p>
    </div>
  );

  return (
    <PageWrapper>
      <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-12">
        <h1 className="font-display text-headline-lg uppercase mb-4">STAFF — PARKING</h1>
        <div className="w-24 h-1 bg-primary-container mb-12" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          <CounterControl label="Cars" count={parking.carCount} capacity={parking.carCapacity}
            onInc={() => update('carCount', 1)} onDec={() => update('carCount', -1)} />
          <CounterControl label="Motorbikes" count={parking.bikeCount} capacity={parking.bikeCapacity}
            onInc={() => update('bikeCount', 1)} onDec={() => update('bikeCount', -1)} />
        </div>
      </div>
    </PageWrapper>
  );
}
