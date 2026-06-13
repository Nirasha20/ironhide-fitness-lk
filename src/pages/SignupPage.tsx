import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { initiatePayHerePayment } from '../lib/payhere';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../lib/firebase';
import { db } from '../lib/firebase';
import { createMember, addPayment, getMembershipPlans } from '../lib/memberService';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { calculateBMI } from '../lib/utils';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import type { MembershipPlan } from '../types';

const STEPS = ['Personal Details', 'Health Info', 'Photo Upload', 'Choose Plan', 'Payment'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center mb-12">
      {STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 flex items-center justify-center border-2 font-display text-sm ${i < current ? 'bg-primary-container border-primary-container text-on-primary-container' : i === current ? 'border-primary-container text-primary-container' : 'border-surface-container-highest text-on-surface-variant'}`}>
              {i < current ? <span className="material-symbols-outlined text-sm">check</span> : i + 1}
            </div>
            <span className="font-label-sm text-label-sm mt-1 text-center hidden md:block text-on-surface-variant">{step}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < current ? 'bg-primary-container' : 'bg-surface-container-highest'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const coupleLinkParam = searchParams.get('coupleLink');

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [personal, setPersonal] = useState({
    fullName: '',
    dob: '',
    gender: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    legacyMembershipId: '',
    transportMode: '',
  });
  const [health, setHealth] = useState({ height: '', weight: '', medicalConditions: '', medications: '', injuries: '' });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank_transfer' | 'cash' | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [coupleData, setCoupleData] = useState<{ primaryUid: string; expiry: Date; tier: string } | null>(null);
  const [coupleLinkError, setCoupleLinkError] = useState('');

  const bmi = health.height && health.weight ? calculateBMI(Number(health.height), Number(health.weight)) : 0;

  // Partner link resolution
  useEffect(() => {
    if (!coupleLinkParam) return;
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'members'),
          where('coupleLinkId', '==', coupleLinkParam),
          where('coupleStatus', '==', 'pending')
        ));
        if (snap.empty) {
          setCoupleLinkError('This invite link is invalid or has already been used.');
          return;
        }
        const primaryDoc = snap.docs[0];
        const data = primaryDoc.data();
        if (!data['membershipTier']?.includes('Couple')) {
          setCoupleLinkError('This invite link is invalid or has already been used.');
          return;
        }
        setCoupleData({
          primaryUid: primaryDoc.id,
          expiry: data['membershipExpiry']?.toDate?.() ?? new Date(),
          tier: data['membershipTier'] as string,
        });
      } catch {
        setCoupleLinkError('Could not validate invite link. Please try again.');
      }
    })();
  }, [coupleLinkParam]);

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const data = await getMembershipPlans();
      setPlans(data.length ? data : [
        { id: '1', name: 'Daily', duration: '1 day', price: 500, features: ['24/7 Access', 'Locker Room'], isActive: true },
        { id: '2', name: 'Monthly', duration: '1 month', price: 5000, features: ['24/7 Access', 'Locker Room', 'Standard Equipment'], isActive: true },
        { id: '3', name: 'Annual', duration: '12 months', price: 48000, features: ['Unlimited Access', 'PT Sessions', 'Apparel Kit', 'VIP Lounge'], isActive: true },
        { id: '4', name: 'Annual — Couple', duration: '12 months', price: 80000, features: ['Everything in Annual', 'Partner Account Included', 'Shared Expiry'], isActive: true },
      ]);
    } catch {
      setPlans([
        { id: '1', name: 'Daily', duration: '1 day', price: 500, features: ['24/7 Access', 'Locker Room'], isActive: true },
        { id: '2', name: 'Monthly', duration: '1 month', price: 5000, features: ['24/7 Access', 'Locker Room', 'Standard Equipment'], isActive: true },
        { id: '3', name: 'Annual', duration: '12 months', price: 48000, features: ['Unlimited Access', 'PT Sessions', 'Apparel Kit', 'VIP Lounge'], isActive: true },
        { id: '4', name: 'Annual — Couple', duration: '12 months', price: 80000, features: ['Everything in Annual', 'Partner Account Included', 'Shared Expiry'], isActive: true },
      ]);
    } finally {
      setPlansLoading(false);
    }
  };

  const validateStep = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!personal.fullName.trim()) errs.fullName = 'Full name is required';
      else if (personal.fullName.trim().length < 2) errs.fullName = 'Enter your full name';
      if (!personal.dob) errs.dob = 'Date of birth is required';
      else {
        const age = (Date.now() - new Date(personal.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (age < 16) errs.dob = 'You must be at least 16 years old';
        if (age > 100) errs.dob = 'Please enter a valid date of birth';
      }
      if (!personal.gender) errs.gender = 'Please select a gender';
      if (!personal.phone.trim()) errs.phone = 'Phone number is required';
      else if (!/^0\d{9}$/.test(personal.phone.replace(/\s/g, ''))) errs.phone = 'Enter a valid Sri Lanka number (07X XXXXXXX)';
      if (!personal.email.trim()) errs.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email)) errs.email = 'Enter a valid email address';
      if (!personal.password) errs.password = 'Password is required';
      else if (personal.password.length < 6) errs.password = 'Password must be at least 6 characters';
      if (!personal.confirmPassword) errs.confirmPassword = 'Please confirm your password';
      else if (personal.password !== personal.confirmPassword) errs.confirmPassword = 'Passwords do not match';
      if (!personal.address.trim()) errs.address = 'Home address is required';
      if (!personal.transportMode) errs.transportMode = 'Please select your usual transport';
    }
    if (step === 3 && !selectedPlan && !coupleData) errs.plan = 'Please select a membership plan';
    return errs;
  };

  const nextStep = async () => {
    const errs = validateStep();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (step === 2 && !plans.length) await loadPlans();
    setStep(s => s + 1);
    setErrors({});
  };
  const prevStep = () => { setStep(s => s - 1); setErrors({}); };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setReceiptFile(file);
  };

  const handleComplete = async () => {
    if (coupleData) {
      // Partner account flow — no payment needed
      setLoading(true);
      setSubmitError('');
      try {
        const userCred = await createUserWithEmailAndPassword(auth, personal.email, personal.password);
        const uid = userCred.user.uid;
        await sendEmailVerification(userCred.user).catch(() => {});

        let photoUrl = '';
        if (photoFile) {
          const photoRef = ref(storage, `members/${uid}/profile.jpg`);
          await uploadBytes(photoRef, photoFile);
          photoUrl = await getDownloadURL(photoRef);
        }

        await createMember(uid, {
          fullName: personal.fullName,
          email: personal.email,
          phone: personal.phone,
          dob: new Date(personal.dob),
          gender: personal.gender,
          address: personal.address,
          emergencyContact: { name: personal.emergencyName, phone: personal.emergencyPhone },
          height: Number(health.height),
          weight: Number(health.weight),
          bmi,
          medicalConditions: health.medicalConditions,
          medications: health.medications,
          injuries: health.injuries,
          photoUrl,
          lockerNumber: '',
          membershipTier: coupleData.tier,
          membershipStatus: 'active',
          membershipExpiry: coupleData.expiry,
        });

        // Write extra couple fields directly
        await updateDoc(doc(db, 'members', uid), {
          linkedMemberUid: coupleData.primaryUid,
          coupleLinkId: coupleLinkParam,
          legacyMembershipId: personal.legacyMembershipId,
          transportMode: personal.transportMode,
        });

        // Update primary member
        await updateDoc(doc(db, 'members', coupleData.primaryUid), {
          coupleStatus: 'linked',
          linkedMemberUid: uid,
        });

        setCompleted(true);
        navigate('/verify-email');
      } catch {
        setSubmitError('Registration failed. The email may already be in use, or try again later.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!privacyAccepted) { setSubmitError('Please accept the data privacy statement to continue.'); return; }
    if (!paymentMethod) { setSubmitError('Please select a payment method.'); return; }
    if (paymentMethod === 'bank_transfer' && !receiptFile) { setSubmitError('Please upload your bank transfer receipt.'); return; }
    setLoading(true);
    setSubmitError('');
    try {
      if (paymentMethod === 'card') {
        initiatePayHerePayment({
          orderId: `IH-${Date.now()}`,
          amount: selectedPlan?.price ?? 0,
          currency: 'LKR',
          itemName: `IronHide ${selectedPlan?.name ?? 'Membership'}`,
          firstName: personal.fullName.split(' ')[0] ?? '',
          lastName: personal.fullName.split(' ').slice(1).join(' ') ?? '',
          email: personal.email,
          phone: personal.phone,
        });
        setLoading(false);
        return;
      }
      const userCred = await createUserWithEmailAndPassword(auth, personal.email, personal.password);
      const uid = userCred.user.uid;
      await sendEmailVerification(userCred.user).catch(() => {});

      let photoUrl = '';
      if (photoFile) {
        const photoRef = ref(storage, `members/${uid}/profile.jpg`);
        await uploadBytes(photoRef, photoFile);
        photoUrl = await getDownloadURL(photoRef);
      }

      let receiptUrl = '';
      if (paymentMethod === 'bank_transfer' && receiptFile) {
        const receiptRef = ref(storage, `members/${uid}/receipts/${Date.now()}.jpg`);
        await uploadBytes(receiptRef, receiptFile);
        receiptUrl = await getDownloadURL(receiptRef);
      }

      const now = new Date();
      const expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + (selectedPlan ? 1 : 1));

      await createMember(uid, {
        fullName: personal.fullName,
        email: personal.email,
        phone: personal.phone,
        dob: new Date(personal.dob),
        gender: personal.gender,
        address: personal.address,
        emergencyContact: { name: personal.emergencyName, phone: personal.emergencyPhone },
        height: Number(health.height),
        weight: Number(health.weight),
        bmi,
        medicalConditions: health.medicalConditions,
        medications: health.medications,
        injuries: health.injuries,
        photoUrl,
        lockerNumber: '',
        membershipTier: selectedPlan?.name ?? '',
        membershipStatus: paymentMethod === 'bank_transfer' ? 'pending_verification' : 'pending_cash',
        membershipExpiry: expiry,
      });

      // Write extra fields
      await updateDoc(doc(db, 'members', uid), {
        legacyMembershipId: personal.legacyMembershipId,
        transportMode: personal.transportMode,
      });

      await addPayment(uid, {
        amount: selectedPlan?.price ?? 0,
        plan: selectedPlan?.name ?? '',
        method: paymentMethod,
        status: paymentMethod === 'cash' ? 'pending_cash' : 'pending_verification',
        receiptUrl,
      });

      // Annual — Couple: generate couple link for primary member
      if (selectedPlan?.name === 'Annual — Couple') {
        const coupleLinkId = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
        await updateDoc(doc(db, 'members', uid), { coupleLinkId, coupleStatus: 'pending' });
        setCompleted(true);
        navigate('/verify-email', { state: { coupleLinkId } });
        return;
      }

      setCompleted(true);
      navigate('/verify-email');
    } catch {
      setSubmitError('Registration failed. The email may already be in use, or try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Couple link error screen
  if (coupleLinkError) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-margin-mobile">
        <div className="max-w-lg text-center space-y-6">
          <div className="font-display text-headline-lg text-primary-container">IRONHIDE</div>
          <div className="bg-surface-container border-t-2 border-primary-container p-8 space-y-6">
            <span className="material-symbols-outlined text-red-400 text-6xl block">link_off</span>
            <h1 className="font-display text-headline-lg uppercase">Invalid Invite Link</h1>
            <p className="font-body text-body-lg text-red-400">{coupleLinkError}</p>
            <Link to="/signup" className="inline-block bg-primary-container text-white px-8 py-4 font-display text-headline-md uppercase hover:scale-105 transition-all">
              Go to Sign Up
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-margin-mobile">
        <div className="max-w-lg text-center">
          <span className="material-symbols-outlined text-primary-container text-6xl mb-6 block">check_circle</span>
          <h1 className="font-display text-headline-lg uppercase mb-4">Registration Complete!</h1>
          <p className="text-body-lg text-on-surface-variant font-body mb-8">
            {paymentMethod === 'cash'
              ? 'Please make payment at the gym reception. Your membership will be activated once confirmed.'
              : 'Your application is under review. You will be notified once your membership is activated.'}
          </p>
          <Button variant="primary" size="lg" onClick={() => navigate('/dashboard')}>GO TO DASHBOARD</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-margin-mobile py-12">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="block font-display text-headline-lg text-primary-container mb-12 text-center">IRONHIDE</Link>
        {coupleLinkParam && coupleData && (
          <div className="mb-6 bg-surface-container border-l-4 border-primary-container p-4">
            <p className="font-label-sm text-label-sm text-primary-container uppercase tracking-widest">Annual Couple — Partner Sign Up</p>
            <p className="font-body text-body-md text-on-surface-variant mt-1">You're creating a linked partner account. No payment required.</p>
          </div>
        )}
        <h1 className="font-display text-headline-md uppercase text-center mb-2">JOIN IRONHIDE</h1>
        <p className="text-body-md text-on-surface-variant text-center font-body mb-8">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        <StepIndicator current={step} />

        <div className="bg-surface-container border-t-2 border-primary-container p-8">
          {step === 0 && (
            <div className="space-y-6">
              <h2 className="font-display text-headline-md uppercase">Personal Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Full Name" value={personal.fullName} onChange={e => setPersonal(p => ({ ...p, fullName: e.target.value }))} error={errors.fullName} placeholder="John Silva" />
                <Input label="Date of Birth" type="date" value={personal.dob} onChange={e => setPersonal(p => ({ ...p, dob: e.target.value }))} error={errors.dob} />
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Gender</label>
                  <select value={personal.gender} onChange={e => setPersonal(p => ({ ...p, gender: e.target.value }))} className={`bg-surface-container border text-on-surface px-4 py-3 focus:outline-none focus:border-primary-container ${errors.gender ? 'border-error' : 'border-border-default'}`}>
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.gender && <span className="text-error text-label-sm">{errors.gender}</span>}
                </div>
                <Input label="Phone Number" value={personal.phone} onChange={e => setPersonal(p => ({ ...p, phone: e.target.value }))} error={errors.phone} placeholder="07X XXX XXXX" />
                <Input label="Email Address" type="email" value={personal.email} onChange={e => setPersonal(p => ({ ...p, email: e.target.value }))} error={errors.email} placeholder="you@email.com" />
                <Input label="Password" type="password" value={personal.password} onChange={e => setPersonal(p => ({ ...p, password: e.target.value }))} error={errors.password} placeholder="Min 6 characters" autoComplete="new-password" autoCapitalize="none" autoCorrect="off" />
                <Input label="Confirm Password" type="password" value={personal.confirmPassword} onChange={e => setPersonal(p => ({ ...p, confirmPassword: e.target.value }))} error={errors.confirmPassword} placeholder="Re-enter password" autoComplete="new-password" autoCapitalize="none" autoCorrect="off" />
              </div>
              <Input label="Home Address" value={personal.address} onChange={e => setPersonal(p => ({ ...p, address: e.target.value }))} error={errors.address} placeholder="Street, City" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Emergency Contact Name" value={personal.emergencyName} onChange={e => setPersonal(p => ({ ...p, emergencyName: e.target.value }))} placeholder="Contact name" />
                <Input label="Emergency Contact Phone" value={personal.emergencyPhone} onChange={e => setPersonal(p => ({ ...p, emergencyPhone: e.target.value }))} placeholder="07X XXX XXXX" />
              </div>
              <Input label="Previous Membership Number (optional)" value={personal.legacyMembershipId} onChange={e => setPersonal(p => ({ ...p, legacyMembershipId: e.target.value.slice(0, 20) }))} placeholder="Enter if you were a previous member" />
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">How do you usually travel to the gym?</label>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {(['Car', 'Motorbike', 'Bicycle', 'Walk', 'Public Transport'] as const).map(mode => (
                    <button key={mode} type="button"
                      onClick={() => setPersonal(p => ({ ...p, transportMode: mode }))}
                      className={`py-3 px-4 border text-body-md font-body transition-all ${personal.transportMode === mode ? 'border-primary-container bg-surface-container-high text-on-surface' : 'border-border-default text-on-surface-variant hover:border-primary-container'}`}>
                      {mode}
                    </button>
                  ))}
                </div>
                {errors.transportMode && <span className="text-error text-label-sm">{errors.transportMode}</span>}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h2 className="font-display text-headline-md uppercase">Health Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Input label="Height (cm)" type="number" value={health.height} onChange={e => setHealth(p => ({ ...p, height: e.target.value }))} placeholder="175" />
                <Input label="Weight (kg)" type="number" value={health.weight} onChange={e => setHealth(p => ({ ...p, weight: e.target.value }))} placeholder="75" />
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">BMI (Auto)</label>
                  <div className="bg-surface-container-high border border-border-default text-on-surface px-4 py-3 font-body text-body-md">
                    {bmi || '—'}
                  </div>
                </div>
              </div>
              <Textarea label="Pre-existing Medical Conditions" value={health.medicalConditions} onChange={e => setHealth(p => ({ ...p, medicalConditions: e.target.value }))} placeholder="List any medical conditions, or write 'None'" rows={3} />
              <Textarea label="Current Medications" value={health.medications} onChange={e => setHealth(p => ({ ...p, medications: e.target.value }))} placeholder="List any medications, or write 'None'" rows={3} />
              <Textarea label="Previous Injuries" value={health.injuries} onChange={e => setHealth(p => ({ ...p, injuries: e.target.value }))} placeholder="List any previous injuries, or write 'None'" rows={3} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="font-display text-headline-md uppercase">Profile Photo</h2>
              <p className="text-body-md text-on-surface-variant font-body">Upload a clear photo of your face for your member profile and face recognition entry.</p>
              <div className="flex flex-col items-center gap-6">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-48 h-48 object-cover border-4 border-primary-container" />
                ) : (
                  <div className="w-48 h-48 bg-surface-container-high border-2 border-border-default flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-surface-variant text-6xl">person</span>
                  </div>
                )}
                <label className="cursor-pointer bg-primary-container text-on-primary-container px-6 py-3 font-display text-body-md uppercase hover:scale-105 transition-all">
                  {photoFile ? 'Change Photo' : 'Upload Photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
                {photoFile && <p className="text-label-sm text-on-surface-variant font-body">{photoFile.name}</p>}
              </div>
              {/* Face Recognition Enrollment */}
              <div className="border border-border-default p-4 space-y-3">
                <p className="font-label-sm text-label-sm text-primary-container uppercase tracking-widest">Face Recognition Entry</p>
                <p className="font-body text-body-md text-on-surface-variant">Your profile photo will be used to enroll you in the gym's face recognition entry system.</p>
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  <p className="font-label-sm text-label-sm uppercase tracking-widest">Enrollment processed after membership activation</p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="font-display text-headline-md uppercase">Choose Your Plan</h2>
              {errors.plan && <p className="text-error text-body-md font-body">{errors.plan}</p>}
              {coupleData ? (
                <div className="bg-surface-container-high p-6 text-center">
                  <p className="font-display text-headline-md uppercase">Partner Account</p>
                  <p className="font-body text-body-md text-on-surface-variant mt-2">You're joining as a partner on an Annual — Couple membership.</p>
                </div>
              ) : plansLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {plans.map(plan => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-6 border-2 cursor-pointer transition-all ${selectedPlan?.id === plan.id ? 'border-primary-container bg-surface-container-high' : 'border-border-default bg-surface-container hover:border-primary-container'}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-display text-headline-md uppercase">{plan.name}</h3>
                          <p className="text-body-md text-on-surface-variant font-body">{plan.duration}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-display text-headline-md text-primary-container">LKR {plan.price.toLocaleString()}</span>
                        </div>
                      </div>
                      <ul className="mt-4 grid grid-cols-2 gap-2">
                        {plan.features.map(f => (
                          <li key={f} className="flex items-center gap-2 text-body-md text-on-surface-variant font-body">
                            <span className="material-symbols-outlined text-primary-container text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="font-display text-headline-md uppercase">Payment</h2>
              {coupleData ? (
                <div className="bg-surface-container-high p-6 text-center">
                  <p className="font-display text-headline-md uppercase">No Payment Required</p>
                  <p className="font-body text-body-md text-on-surface-variant mt-2">Your membership is covered by the primary account holder.</p>
                </div>
              ) : (
                <>
                  {selectedPlan && (
                    <div className="bg-surface-container-high p-4 border-l-4 border-primary-container">
                      <p className="font-body text-body-md text-on-surface-variant">Selected Plan:</p>
                      <p className="font-display text-headline-md">{selectedPlan.name} — LKR {selectedPlan.price.toLocaleString()}</p>
                    </div>
                  )}
                  <div className="space-y-4">
                    <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Select Payment Method</p>
                    {([
                      { method: 'card' as const, icon: 'credit_card', label: 'Credit/Debit Card', desc: 'Pay securely via PayHere' },
                      { method: 'bank_transfer' as const, icon: 'account_balance', label: 'Bank Transfer', desc: 'Upload receipt for verification' },
                      { method: 'cash' as const, icon: 'payments', label: 'Cash at Gym', desc: 'Pay at reception' },
                    ]).map(opt => (
                      <div
                        key={opt.method}
                        onClick={() => setPaymentMethod(opt.method)}
                        className={`p-4 border-2 cursor-pointer flex items-center gap-4 transition-all ${paymentMethod === opt.method ? 'border-primary-container bg-surface-container-high' : 'border-border-default hover:border-primary-container'}`}
                      >
                        <span className="material-symbols-outlined text-primary-container text-3xl">{opt.icon}</span>
                        <div>
                          <p className="font-display text-headline-md">{opt.label}</p>
                          <p className="text-body-md text-on-surface-variant font-body">{opt.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {paymentMethod === 'bank_transfer' && (
                    <div className="space-y-4 border border-border-default p-4">
                      <p className="font-body text-body-md text-on-surface-variant">Bank: Commercial Bank of Ceylon<br />Account: 8001234567<br />Name: IronHide Fitness (Pvt) Ltd</p>
                      <label className="cursor-pointer inline-flex items-center gap-2 bg-surface-container text-on-surface px-4 py-2 border border-border-default hover:border-primary-container transition-all">
                        <span className="material-symbols-outlined">upload</span>
                        <span className="font-body text-body-md">{receiptFile ? receiptFile.name : 'Upload Receipt'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleReceiptChange} />
                      </label>
                    </div>
                  )}

                  {paymentMethod === 'cash' && (
                    <div className="border border-yellow-600 bg-yellow-600/10 p-4">
                      <p className="text-body-md font-body text-yellow-400">Please make payment at the gym reception at 114C Negombo Rd, Wattala. Your membership will be activated once payment is confirmed.</p>
                    </div>
                  )}

                  {/* Data Privacy Statement */}
                  <div className="border border-border-default p-4 space-y-3">
                    <p className="font-label-sm text-label-sm text-primary-container uppercase tracking-widest">Data Privacy Statement</p>
                    <p className="font-body text-body-md text-on-surface-variant">
                      IronHide Fitness collects and stores your personal information (name, contact details, date of birth, health data, and profile photo) solely for the purpose of managing your gym membership, ensuring your safety during training, and communicating gym updates with you.
                    </p>
                    <p className="font-body text-body-md text-on-surface-variant">
                      Your data is stored securely and will not be shared with third parties without your consent, except where required by law. You may request access to, correction of, or deletion of your data at any time by contacting the gym management.
                    </p>
                    <p className="font-body text-body-md text-on-surface-variant">
                      Health information (medical conditions, medications, injuries) is collected to protect your safety and will only be accessed by authorised staff. By registering, you consent to this data being held for the duration of your membership and for a period of 2 years thereafter.
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={privacyAccepted}
                        onChange={e => setPrivacyAccepted(e.target.checked)}
                        className="mt-1 accent-[#cc0000] w-4 h-4 shrink-0"
                      />
                      <span className="font-body text-body-md text-on-surface">
                        I have read and agree to the{' '}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-container hover:underline">Terms & Conditions</a>
                        {' '}and{' '}
                        <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary-container hover:underline">Privacy Policy</a>.
                        {' '}I consent to IronHide Fitness collecting and processing my personal and health data as described.
                      </span>
                    </label>
                  </div>

                  {submitError && <p className="text-error text-body-md font-body">{submitError}</p>}
                </>
              )}
              {coupleData && submitError && <p className="text-error text-body-md font-body">{submitError}</p>}
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-border-default">
            {step > 0 ? (
              <Button variant="ghost" onClick={prevStep}>← BACK</Button>
            ) : (
              <Link to="/login" className="text-on-surface-variant hover:text-on-surface text-body-md font-body self-center">Already a member?</Link>
            )}
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={nextStep}>NEXT →</Button>
            ) : (
              <Button variant="primary" loading={loading} onClick={handleComplete}>
                {coupleData ? 'CREATE PARTNER ACCOUNT' : 'COMPLETE REGISTRATION'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
