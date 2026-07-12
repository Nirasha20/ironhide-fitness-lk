import React, { useState, useEffect, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { getMember, updateMember, getPartners, updatePartner } from '../lib/memberService';
import { calculateBMI } from '../lib/utils';
import { PageWrapper } from '../components/layout/PageWrapper';
import { AuthGuard } from '../components/layout/AuthGuard';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import type { Member, Partner } from '../types';

function ProfileContent() {
  const { user } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerForm, setPartnerForm] = useState({
    fullName: '', dob: '', gender: '', phone: '',
    address: '',
    emergencyName: '', emergencyPhone: '',
    height: '', weight: '',
    medicalConditions: '', medications: '', injuries: '',
  });
  const [partnerPhotoFile, setPartnerPhotoFile] = useState<File | null>(null);
  const [partnerPhotoPreview, setPartnerPhotoPreview] = useState('');
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [partnerSaved, setPartnerSaved] = useState(false);
  const partnerSectionRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState({
    fullName: '', phone: '', address: '',
    emergencyName: '', emergencyPhone: '',
    height: '', weight: '',
    medicalConditions: '', medications: '', injuries: '',
  });

  useEffect(() => {
    if (!user) return;
    Promise.all([getMember(user.uid), getPartners(user.uid)])
      .then(([m, partners]) => {
        if (m) {
          setMember(m);
          setForm({
            fullName: m.fullName,
            phone: m.phone,
            address: m.address,
            emergencyName: m.emergencyContact.name,
            emergencyPhone: m.emergencyContact.phone,
            height: String(m.height),
            weight: String(m.weight),
            medicalConditions: m.medicalConditions,
            medications: m.medications,
            injuries: m.injuries,
          });
        }
        setPartner(partners[0] ?? null);
        if (partners[0]) {
          setPartnerForm({
            fullName: partners[0].fullName,
            dob: partners[0].dob.toISOString().split('T')[0],
            gender: partners[0].gender,
            phone: partners[0].phone,
            address: partners[0].address,
            emergencyName: partners[0].emergencyContact.name,
            emergencyPhone: partners[0].emergencyContact.phone,
            height: partners[0].height ? String(partners[0].height) : '',
            weight: partners[0].weight ? String(partners[0].weight) : '',
            medicalConditions: partners[0].medicalConditions,
            medications: partners[0].medications,
            injuries: partners[0].injuries,
          });
          setPartnerPhotoPreview(partners[0].photoUrl);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePartnerPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPartnerPhotoFile(file);
    setPartnerPhotoPreview(URL.createObjectURL(file));
  };

  const scrollToPartnerSection = () => {
    partnerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePartnerSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !partner) return;
    setPartnerSaving(true);
    try {
      let photoUrl = partner.photoUrl ?? '';
      if (partnerPhotoFile) {
        const photoRef = ref(storage, `members/${user.uid}/partner-profile.jpg`);
        await uploadBytes(photoRef, partnerPhotoFile);
        photoUrl = await getDownloadURL(photoRef);
      }
      await updatePartner(user.uid, partner.id, {
        fullName: partnerForm.fullName,
        dob: new Date(partnerForm.dob),
        gender: partnerForm.gender,
        phone: partnerForm.phone,
        address: partnerForm.address,
        emergencyContact: { name: partnerForm.emergencyName, phone: partnerForm.emergencyPhone },
        height: partnerForm.height ? Number(partnerForm.height) : null,
        weight: partnerForm.weight ? Number(partnerForm.weight) : null,
        bmi: partnerForm.height && partnerForm.weight ? calculateBMI(Number(partnerForm.height), Number(partnerForm.weight)) : null,
        medicalConditions: partnerForm.medicalConditions,
        medications: partnerForm.medications,
        injuries: partnerForm.injuries,
        photoUrl,
      });
      setPartner(prev => prev ? {
        ...prev,
        fullName: partnerForm.fullName,
        dob: new Date(partnerForm.dob),
        gender: partnerForm.gender,
        phone: partnerForm.phone,
        address: partnerForm.address,
        emergencyContact: { name: partnerForm.emergencyName, phone: partnerForm.emergencyPhone },
        height: partnerForm.height ? Number(partnerForm.height) : null,
        weight: partnerForm.weight ? Number(partnerForm.weight) : null,
        bmi: partnerForm.height && partnerForm.weight ? calculateBMI(Number(partnerForm.height), Number(partnerForm.weight)) : null,
        medicalConditions: partnerForm.medicalConditions,
        medications: partnerForm.medications,
        injuries: partnerForm.injuries,
        photoUrl,
      } : prev);
      setPartnerSaved(true);
      setTimeout(() => setPartnerSaved(false), 3000);
    } catch {
      // handle error
    } finally {
      setPartnerSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      let photoUrl = member?.photoUrl ?? '';
      if (photoFile) {
        const photoRef = ref(storage, `members/${user.uid}/profile.jpg`);
        await uploadBytes(photoRef, photoFile);
        photoUrl = await getDownloadURL(photoRef);
      }
      const bmi = calculateBMI(Number(form.height), Number(form.weight));
      await updateMember(user.uid, {
        fullName: form.fullName,
        phone: form.phone,
        address: form.address,
        emergencyContact: { name: form.emergencyName, phone: form.emergencyPhone },
        height: Number(form.height),
        weight: Number(form.weight),
        bmi,
        medicalConditions: form.medicalConditions,
        medications: form.medications,
        injuries: form.injuries,
        photoUrl,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-12 animate-pulse">
      <div className="h-10 w-48 bg-surface-container-high mb-4" />
      <div className="h-1 w-24 bg-surface-container-high mb-12" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="flex flex-col items-center gap-6">
          <div className="w-48 h-48 bg-surface-container-high" />
          <div className="h-9 w-32 bg-surface-container-high" />
        </div>
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-6"><div className="h-14 bg-surface-container-high" /><div className="h-14 bg-surface-container-high" /></div>
          <div className="h-14 bg-surface-container-high" />
          <div className="grid grid-cols-2 gap-6"><div className="h-14 bg-surface-container-high" /><div className="h-14 bg-surface-container-high" /></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop py-12">
      <h1 className="font-display text-headline-lg uppercase mb-4">EDIT PROFILE</h1>
      <div className="w-24 h-1 bg-primary-container mb-6" />

      {member?.membershipTier?.includes('Couple') && (
        <div className="mb-8">
          <Button type="button" variant="secondary" onClick={scrollToPartnerSection}>
            Edit Partner Details
          </Button>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="flex flex-col items-center gap-6">
          <div className="w-48 h-48 border-4 border-primary-container overflow-hidden">
            {(photoPreview || member?.photoUrl) ? (
              <img src={photoPreview || member?.photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant text-6xl">person</span>
              </div>
            )}
          </div>
          <label className="cursor-pointer bg-surface-container text-on-surface px-4 py-2 border border-border-default hover:border-primary-container transition-all font-body text-body-md">
            Change Photo
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
          {member && (
            <div className="text-center space-y-1">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Email</p>
              <p className="font-body text-body-md">{member.email}</p>
            </div>
          )}
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Full Name" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} />
            <Input label="Phone Number" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <Input label="Home Address" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Emergency Contact Name" value={form.emergencyName} onChange={e => setForm(p => ({ ...p, emergencyName: e.target.value }))} />
            <Input label="Emergency Contact Phone" value={form.emergencyPhone} onChange={e => setForm(p => ({ ...p, emergencyPhone: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Height (cm)" type="number" value={form.height} onChange={e => setForm(p => ({ ...p, height: e.target.value }))} />
            <Input label="Weight (kg)" type="number" value={form.weight} onChange={e => setForm(p => ({ ...p, weight: e.target.value }))} />
          </div>
          <Textarea label="Medical Conditions" value={form.medicalConditions} onChange={e => setForm(p => ({ ...p, medicalConditions: e.target.value }))} rows={3} />
          <Textarea label="Current Medications" value={form.medications} onChange={e => setForm(p => ({ ...p, medications: e.target.value }))} rows={3} />
          <Textarea label="Previous Injuries" value={form.injuries} onChange={e => setForm(p => ({ ...p, injuries: e.target.value }))} rows={3} />

          <div className="flex items-center gap-4">
            <Button type="submit" variant="primary" size="lg" loading={saving}>SAVE CHANGES</Button>
            {saved && <span className="text-green-400 font-body text-body-md">✓ Saved successfully</span>}
          </div>
        </div>
      </form>

      {member?.membershipTier?.includes('Couple') && (
        <div ref={partnerSectionRef} className="mt-16 border-t border-surface-variant pt-12">
          <h2 className="font-display text-headline-lg uppercase mb-4">Edit Partner Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center gap-6">
              <div className="w-48 h-48 border-4 border-primary-container overflow-hidden">
                {(partnerPhotoPreview || partner?.photoUrl) ? (
                  <img src={partnerPhotoPreview || partner?.photoUrl} alt="Partner Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-surface-variant text-6xl">person</span>
                  </div>
                )}
              </div>
              <label className="cursor-pointer bg-surface-container text-on-surface px-4 py-2 border border-border-default hover:border-primary-container transition-all font-body text-body-md">
                Change Partner Photo
                <input type="file" accept="image/*" className="hidden" onChange={handlePartnerPhotoChange} />
              </label>
            </div>

            <div className="md:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Partner Full Name" value={partnerForm.fullName} onChange={e => setPartnerForm(p => ({ ...p, fullName: e.target.value }))} />
                <Input label="Partner Phone" value={partnerForm.phone} onChange={e => setPartnerForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Partner DOB" type="date" value={partnerForm.dob} onChange={e => setPartnerForm(p => ({ ...p, dob: e.target.value }))} />
                <Input label="Partner Gender" value={partnerForm.gender} onChange={e => setPartnerForm(p => ({ ...p, gender: e.target.value }))} />
              </div>
              <Input label="Partner Address" value={partnerForm.address || ''} onChange={e => setPartnerForm(p => ({ ...p, address: e.target.value }))} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Partner Emergency Contact" value={partnerForm.emergencyName} onChange={e => setPartnerForm(p => ({ ...p, emergencyName: e.target.value }))} />
                <Input label="Partner Emergency Phone" value={partnerForm.emergencyPhone} onChange={e => setPartnerForm(p => ({ ...p, emergencyPhone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Partner Height (cm)" type="number" value={partnerForm.height} onChange={e => setPartnerForm(p => ({ ...p, height: e.target.value }))} />
                <Input label="Partner Weight (kg)" type="number" value={partnerForm.weight} onChange={e => setPartnerForm(p => ({ ...p, weight: e.target.value }))} />
              </div>
              <Textarea label="Partner Medical Conditions" value={partnerForm.medicalConditions} onChange={e => setPartnerForm(p => ({ ...p, medicalConditions: e.target.value }))} rows={3} />
              <Textarea label="Partner Current Medications" value={partnerForm.medications} onChange={e => setPartnerForm(p => ({ ...p, medications: e.target.value }))} rows={3} />
              <Textarea label="Partner Previous Injuries" value={partnerForm.injuries} onChange={e => setPartnerForm(p => ({ ...p, injuries: e.target.value }))} rows={3} />

              <div className="flex items-center gap-4">
                <Button type="button" variant="primary" size="lg" loading={partnerSaving} onClick={handlePartnerSave}>SAVE PARTNER</Button>
                {partnerSaved && <span className="text-green-400 font-body text-body-md">✓ Partner saved</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <PageWrapper>
        <ProfileContent />
      </PageWrapper>
    </AuthGuard>
  );
}
