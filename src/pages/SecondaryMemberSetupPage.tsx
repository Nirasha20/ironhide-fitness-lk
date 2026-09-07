import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, storage } from "../lib/firebase";
import { createMember, getInviteToken, markInviteUsed } from "../lib/memberService";
import { calculateBMI, isStrongPassword } from "../lib/utils";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import type { CoupleInvite } from "../lib/memberService";

const SETUP_STEPS = ["Set Password", "Personal Details", "Health Info", "Photo Upload"];

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center mb-12">
      {steps.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 flex items-center justify-center border-2 font-display text-sm ${i < current ? "bg-primary-container border-primary-container text-on-primary-container" : i === current ? "border-primary-container text-primary-container" : "border-surface-container-highest text-on-surface-variant"}`}>
              {i < current ? <span className="material-symbols-outlined text-sm">check</span> : i + 1}
            </div>
            <span className="font-label-sm text-label-sm mt-1 text-center hidden md:block text-on-surface-variant">{step}</span>
          </div>
          {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < current ? "bg-primary-container" : "bg-surface-container-highest"}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function SecondaryMemberSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [invite, setInvite] = useState<CoupleInvite | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [completed, setCompleted] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [personal, setPersonal] = useState({
    fullName: "",
    dob: "",
    gender: "",
    phone: "",
    address: "",
    emergencyName: "",
    emergencyPhone: "",
  });

  const [health, setHealth] = useState({
    height: "",
    weight: "",
    medicalConditions: "",
    medications: "",
    injuries: "",
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const bmi = health.height && health.weight ? calculateBMI(Number(health.height), Number(health.weight)) : 0;
  const currentStepName = SETUP_STEPS[step];

  useEffect(() => {
    if (!token) {
      setTokenError("No invite token found. Please check your invitation email and try again.");
      setTokenLoading(false);
      return;
    }
    (async () => {
      try {
        const inv = await getInviteToken(token);
        if (!inv) {
          setTokenError("This invitation link is invalid or has expired. Please contact the gym for assistance.");
        } else if (inv.used) {
          setTokenError("This invitation has already been used. If you need help accessing your account, please contact us.");
        } else if (new Date() > inv.inviteExpiry) {
          setTokenError("This invitation link has expired (valid for 7 days). Please ask your partner to resend the invite.");
        } else {
          setInvite(inv);
        }
      } catch {
        setTokenError("Could not verify your invitation. Please check your connection and try again.");
      } finally {
        setTokenLoading(false);
      }
    })();
  }, [token]);

  const validateStep = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (currentStepName === "Set Password") {
      if (!password) errs.password = "Password is required";
      else if (!isStrongPassword(password)) errs.password = "Use at least 8 characters including uppercase, lowercase, number, and symbol";
      if (!confirmPassword) errs.confirmPassword = "Please confirm your password";
      else if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    }
    if (currentStepName === "Personal Details") {
      if (!personal.fullName.trim()) errs.fullName = "Full name is required";
      else if (personal.fullName.trim().length < 2) errs.fullName = "Enter your full name";
      if (!personal.dob) errs.dob = "Date of birth is required";
      else {
        const age = (Date.now() - new Date(personal.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (age < 16) errs.dob = "You must be at least 16 years old";
        if (age > 100) errs.dob = "Please enter a valid date of birth";
      }
      if (!personal.gender) errs.gender = "Please select a gender";
      if (!personal.phone.trim()) errs.phone = "Phone number is required";
      else if (!/^0\d{9}$/.test(personal.phone.replace(/\s/g, ""))) errs.phone = "Enter a valid Sri Lanka number (07X XXXXXXX)";
      if (!personal.address.trim()) errs.address = "Home address is required";
    }
    return errs;
  };

  const nextStep = () => {
    const errs = validateStep();
    if (Object.keys(errs).length) { setErrors(errs); return; }
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

  const handleComplete = async () => {
    if (!privacyAccepted) { setSubmitError("Please accept the data privacy statement to continue."); return; }
    if (!invite) return;
    setLoading(true);
    setSubmitError("");
    try {
      const userCred = await createUserWithEmailAndPassword(auth, invite.secondaryEmail, password);
      const uid = userCred.user.uid;
      try { await sendEmailVerification(userCred.user); } catch { /* non-fatal */ }

      let photoUrl = "";
      if (photoFile) {
        const photoRef = ref(storage, `members/${uid}/profile.jpg`);
        await uploadBytes(photoRef, photoFile);
        photoUrl = await getDownloadURL(photoRef);
      }

      await createMember(uid, {
        fullName: personal.fullName,
        email: invite.secondaryEmail,
        phone: personal.phone,
        dob: new Date(personal.dob),
        gender: personal.gender,
        address: personal.address,
        emergencyContact: { name: personal.emergencyName, phone: personal.emergencyPhone },
        height: Number(health.height) || 0,
        weight: Number(health.weight) || 0,
        bmi: bmi || 0,
        medicalConditions: health.medicalConditions,
        medications: health.medications,
        injuries: health.injuries,
        photoUrl,
        lockerNumber: "",
        membershipTier: invite.plan,
        membershipStatus: "active",
        membershipExpiry: invite.membershipExpiry,
        linkedPrimaryUid: invite.primaryUid,
        isSecondaryMember: true,
      });

      await markInviteUsed(token);
      setCompleted(true);
    } catch (err: any) {
      if (err?.code === "auth/email-already-in-use") {
        setSubmitError("An account already exists for this email. Please log in instead.");
      } else if (err?.code === "auth/weak-password") {
        setSubmitError("Password is too weak. Please use at least 8 characters including uppercase, lowercase, number, and symbol.");
      } else {
        setSubmitError("Account setup failed. Please try again or contact support.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (tokenLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center space-y-4">
          <Spinner />
          <p className="font-body text-body-md text-on-surface-variant">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-margin-mobile">
        <div className="max-w-md text-center space-y-6">
          <span className="material-symbols-outlined text-error text-6xl block">error</span>
          <h1 className="font-display text-headline-md uppercase">Invitation Invalid</h1>
          <p className="font-body text-body-md text-on-surface-variant">{tokenError}</p>
          <div className="space-y-3">
            <p className="font-body text-body-sm text-on-surface-variant">+94 70 322 2211 · support@ironhidefitness.lk</p>
            <Link to="/login" className="inline-flex items-center gap-2 text-primary-container hover:underline font-body text-body-md">
              Go to Login <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-margin-mobile">
        <div className="max-w-lg text-center space-y-6">
          <span className="material-symbols-outlined text-primary-container text-6xl block">check_circle</span>
          <h1 className="font-display text-headline-lg uppercase">Welcome to IronHide!</h1>
          <p className="font-body text-body-lg text-on-surface-variant">
            Your account is set up and your <strong>{invite?.plan}</strong> membership is active. You are ready to train!
          </p>
          <div className="border border-primary-container/30 bg-surface-container-high p-4 text-left space-y-2">
            <p className="font-label-sm text-label-sm text-primary-container uppercase tracking-widest">Your Membership</p>
            <p className="font-body text-body-md text-on-surface-variant">Plan: <strong>{invite?.plan}</strong></p>
            <p className="font-body text-body-md text-on-surface-variant">Expires: <strong>{invite?.membershipExpiry.toDateString()}</strong></p>
            <p className="font-body text-body-md text-on-surface-variant">Status: <strong className="text-green-400">ACTIVE</strong></p>
          </div>
          <Button variant="primary" size="lg" onClick={() => navigate("/dashboard")}>GO TO MY DASHBOARD</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-margin-mobile py-12">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="block font-display text-headline-lg text-primary-container mb-8 text-center">IRONHIDE FITNESS</Link>

        <div className="bg-surface-container border border-primary-container/30 p-4 mb-8 flex items-center gap-4">
          <span className="material-symbols-outlined text-primary-container text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>people</span>
          <div>
            <p className="font-label-sm text-label-sm text-primary-container uppercase tracking-widest">Couple Plan - Secondary Member Setup</p>
            <p className="font-body text-body-md text-on-surface-variant">
              <strong>{invite?.primaryName}</strong> has registered you for an <strong>{invite?.plan}</strong> membership. Set up your personal account below - no payment needed.
            </p>
          </div>
        </div>

        <h1 className="font-display text-headline-md uppercase text-center mb-2">SET UP YOUR ACCOUNT</h1>
        <p className="text-body-md text-on-surface-variant text-center font-body mb-8">Step {step + 1} of {SETUP_STEPS.length} - {currentStepName}</p>
        <StepIndicator current={step} steps={SETUP_STEPS} />

        <div className="bg-surface-container border-t-2 border-primary-container p-8">

          {currentStepName === "Set Password" && (
            <div className="space-y-6">
              <h2 className="font-display text-headline-md uppercase">Create Your Password</h2>
              <div className="bg-surface-container-high border border-border-default p-4 space-y-1">
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Your email address</p>
                <p className="font-body text-body-md text-on-surface">{invite?.secondaryEmail}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} error={errors.password} placeholder="Min 8 characters" autoComplete="new-password" autoCapitalize="none" autoCorrect="off" />
                <Input label="Confirm Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} error={errors.confirmPassword} placeholder="Re-enter password" autoComplete="new-password" autoCapitalize="none" autoCorrect="off" />
              </div>
              <div className="border border-border-default p-4 space-y-2">
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Password requirements</p>
                {["At least 8 characters", "At least one uppercase letter", "At least one lowercase letter", "At least one number", "At least one special character"].map(req => (
                  <p key={req} className="flex items-center gap-2 font-body text-body-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm">check</span>{req}
                  </p>
                ))}
              </div>
            </div>
          )}

          {currentStepName === "Personal Details" && (
            <div className="space-y-6">
              <h2 className="font-display text-headline-md uppercase">Personal Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Full Name" value={personal.fullName} onChange={e => setPersonal(p => ({ ...p, fullName: e.target.value }))} error={errors.fullName} placeholder="Jane Silva" />
                <Input label="Date of Birth" type="date" value={personal.dob} onChange={e => setPersonal(p => ({ ...p, dob: e.target.value }))} error={errors.dob} />
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Gender</label>
                  <select value={personal.gender} onChange={e => setPersonal(p => ({ ...p, gender: e.target.value }))} className={`bg-surface-container border text-on-surface px-4 py-3 focus:outline-none focus:border-primary-container ${errors.gender ? "border-error" : "border-border-default"}`}>
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.gender && <span className="text-error text-label-sm">{errors.gender}</span>}
                </div>
                <Input label="Phone Number" value={personal.phone} onChange={e => setPersonal(p => ({ ...p, phone: e.target.value }))} error={errors.phone} placeholder="07X XXX XXXX" />
              </div>
              <Input label="Home Address" value={personal.address} onChange={e => setPersonal(p => ({ ...p, address: e.target.value }))} error={errors.address} placeholder="Street, City" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Emergency Contact Name" value={personal.emergencyName} onChange={e => setPersonal(p => ({ ...p, emergencyName: e.target.value }))} placeholder="Contact name" />
                <Input label="Emergency Contact Phone" value={personal.emergencyPhone} onChange={e => setPersonal(p => ({ ...p, emergencyPhone: e.target.value }))} placeholder="07X XXX XXXX" />
              </div>
            </div>
          )}

          {currentStepName === "Health Info" && (
            <div className="space-y-6">
              <h2 className="font-display text-headline-md uppercase">Health Information</h2>
              <p className="font-body text-body-md text-on-surface-variant">Kept strictly confidential and used only for your safety.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Input label="Height (cm)" type="number" value={health.height} onChange={e => setHealth(p => ({ ...p, height: e.target.value }))} placeholder="165" />
                <Input label="Weight (kg)" type="number" value={health.weight} onChange={e => setHealth(p => ({ ...p, weight: e.target.value }))} placeholder="60" />
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">BMI (Auto)</label>
                  <div className="bg-surface-container-high border border-border-default text-on-surface px-4 py-3 font-body text-body-md">{bmi || "-"}</div>
                </div>
              </div>
              <Textarea label="Pre-existing Medical Conditions" value={health.medicalConditions} onChange={e => setHealth(p => ({ ...p, medicalConditions: e.target.value }))} placeholder="List any medical conditions, or write None" rows={3} />
              <Textarea label="Current Medications" value={health.medications} onChange={e => setHealth(p => ({ ...p, medications: e.target.value }))} placeholder="List any medications, or write None" rows={3} />
              <Textarea label="Previous Injuries" value={health.injuries} onChange={e => setHealth(p => ({ ...p, injuries: e.target.value }))} placeholder="List any previous injuries, or write None" rows={3} />
            </div>
          )}

          {currentStepName === "Photo Upload" && (
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
                  {photoFile ? "Change Photo" : "Upload Photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
                {photoFile && <p className="text-label-sm text-on-surface-variant font-body">{photoFile.name}</p>}
              </div>

              <div className="border border-border-default p-4 space-y-3">
                <p className="font-label-sm text-label-sm text-primary-container uppercase tracking-widest">Data Privacy Statement</p>
                <p className="font-body text-body-md text-on-surface-variant">
                  IronHide Fitness collects and stores your personal information solely for the purpose of managing your gym membership. Your data is stored securely and will not be shared with third parties.
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={privacyAccepted} onChange={e => setPrivacyAccepted(e.target.checked)} className="mt-1 accent-[#cc0000] w-4 h-4 shrink-0" />
                  <span className="font-body text-body-md text-on-surface">
                    I have read and agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-container hover:underline">Terms & Conditions</a> and <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary-container hover:underline">Privacy Policy</a>.
                  </span>
                </label>
              </div>

              {submitError && (
                <div className="border border-error bg-error/10 p-4">
                  <p className="text-error text-body-md font-body">{submitError}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-border-default">
            {step > 0 ? (
              <Button variant="ghost" onClick={prevStep}>Back</Button>
            ) : (
              <Link to="/login" className="text-on-surface-variant hover:text-on-surface text-body-md font-body self-center">Already have an account?</Link>
            )}
            {step < SETUP_STEPS.length - 1 ? (
              <Button variant="primary" onClick={nextStep}>NEXT</Button>
            ) : (
              <Button variant="primary" loading={loading} onClick={handleComplete}>COMPLETE SETUP</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
