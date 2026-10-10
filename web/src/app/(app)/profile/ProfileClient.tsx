"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";
import { Avatar } from "@/components/Avatar";
import type { MyProfile } from "@/lib/types";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

type Msg = { kind: "ok" | "error"; text: string } | null;

export function ProfileClient({ profile, avatarUrl }: { profile: MyProfile; avatarUrl: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile.full_name);
  const [hospital, setHospital] = useState(profile.hospital ?? "");
  const [specialty, setSpecialty] = useState(profile.specialty ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarPath, setAvatarPath] = useState(profile.avatar_path);
  const [photo, setPhoto] = useState<string | null>(avatarUrl);

  const [saving, setSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState<Msg>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<Msg>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setInfoMsg(null);
    const { error } = await createClient()
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        hospital: hospital.trim() || null,
        specialty: specialty.trim() || null,
        phone: phone.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) return setInfoMsg({ kind: "error", text: t("prof.saveFailed") });
    setInfoMsg({ kind: "ok", text: t("prof.saved") });
    router.refresh(); // met à jour le nom dans l'en-tête
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoMsg(null);
    // Le bucket revérifie le type et la taille : ce contrôle évite seulement un aller-retour inutile.
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    if ((!isPng && !isJpeg) || file.size > MAX_AVATAR_BYTES || file.size === 0) {
      return setPhotoMsg({ kind: "error", text: t("prof.photoBad") });
    }

    setPhotoBusy(true);
    const supabase = createClient();
    const path = `${profile.id}/${Date.now()}.${isPng ? "png" : "jpg"}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { contentType: isPng ? "image/png" : "image/jpeg", upsert: false });
    if (upErr) {
      setPhotoBusy(false);
      return setPhotoMsg({ kind: "error", text: t("prof.photoFailed") });
    }
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", profile.id);
    if (dbErr) {
      await supabase.storage.from("avatars").remove([path]);
      setPhotoBusy(false);
      return setPhotoMsg({ kind: "error", text: t("prof.photoFailed") });
    }
    if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]); // pas de photo orpheline
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
    setAvatarPath(path);
    setPhoto(data?.signedUrl ?? null);
    setPhotoBusy(false);
    setPhotoMsg({ kind: "ok", text: t("prof.photoSaved") });
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function removePhoto() {
    if (!avatarPath) return;
    setPhotoBusy(true);
    setPhotoMsg(null);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", profile.id);
    if (error) {
      setPhotoBusy(false);
      return setPhotoMsg({ kind: "error", text: t("prof.photoFailed") });
    }
    await supabase.storage.from("avatars").remove([avatarPath]);
    setAvatarPath(null);
    setPhoto(null);
    setPhotoBusy(false);
    setPhotoMsg({ kind: "ok", text: t("prof.photoRemoved") });
    router.refresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwMsg(null);
    const { error } = await createClient().auth.updateUser({ password: newPassword });
    setPwBusy(false);
    if (error) return setPwMsg({ kind: "error", text: t("prof.passwordFailed") });
    setNewPassword("");
    setPwMsg({ kind: "ok", text: t("prof.passwordSaved") });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("prof.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("prof.subtitle")}</p>
      </div>

      <section aria-labelledby="photo" className="card flex flex-wrap items-center gap-6 p-6">
        <Avatar name={fullName} url={photo} size={96} />
        <div className="min-w-0 flex-1">
          <h2 id="photo" className="font-semibold">{t("prof.photo")}</h2>
          <p className="mt-1 text-xs text-muted">{t("prof.photoHint")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input ref={fileRef} id="avatar-file" type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => onPickPhoto(e.target.files?.[0])} disabled={photoBusy} />
            <label htmlFor="avatar-file" className={`btn-primary cursor-pointer ${photoBusy ? "pointer-events-none opacity-50" : ""}`}>
              {photoBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Camera size={16} aria-hidden />} {t("prof.change")}
            </label>
            {avatarPath && (
              <button type="button" onClick={removePhoto} disabled={photoBusy} className="btn-secondary">
                <Trash2 size={16} aria-hidden /> {t("prof.remove")}
              </button>
            )}
          </div>
          <Message msg={photoMsg} />
        </div>
      </section>

      <form onSubmit={saveInfo} className="card space-y-4 p-6" aria-labelledby="info">
        <h2 id="info" className="font-semibold">{t("prof.info")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="p-name" label={t("prof.fullName")} value={fullName} onChange={setFullName} required maxLength={120} autoComplete="name" />
          <div>
            <label htmlFor="p-email" className="mb-1.5 block text-sm font-medium">{t("prof.email")}</label>
            <input id="p-email" className="field" value={profile.email ?? ""} readOnly disabled aria-describedby="p-email-hint" />
            <p id="p-email-hint" className="mt-1 text-xs text-muted">{t("prof.emailHint")}</p>
          </div>
          <Field id="p-hospital" label={t("prof.hospital")} value={hospital} onChange={setHospital} maxLength={160} autoComplete="organization" />
          <Field id="p-specialty" label={t("prof.specialty")} value={specialty} onChange={setSpecialty} maxLength={120} />
          <Field id="p-phone" label={t("prof.phone")} value={phone} onChange={setPhone} maxLength={40} type="tel" autoComplete="tel" />
          <div>
            <span className="mb-1.5 block text-sm font-medium">{t("prof.role")}</span>
            <p className="field !bg-bg text-muted">{profile.role === "admin" ? t("prof.roleAdmin") : t("prof.roleDoctor")}</p>
          </div>
        </div>
        <div>
          <label htmlFor="p-bio" className="mb-1.5 block text-sm font-medium">{t("prof.bio")}</label>
          <textarea id="p-bio" className="field resize-y" rows={3} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving || !fullName.trim()} className="btn-primary">
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden />} {saving ? t("common.saving") : t("common.save")}
          </button>
          <Message msg={infoMsg} />
        </div>
      </form>

      <form onSubmit={changePassword} className="card space-y-4 p-6" aria-labelledby="pw">
        <h2 id="pw" className="font-semibold">{t("prof.password")}</h2>
        <div className="max-w-sm">
          <label htmlFor="p-newpw" className="mb-1.5 block text-sm font-medium">{t("prof.newPassword")}</label>
          <input id="p-newpw" type="password" className="field" autoComplete="new-password" minLength={10} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} aria-describedby="p-newpw-hint" required />
          <p id="p-newpw-hint" className="mt-1 text-xs text-muted">{t("prof.passwordHint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pwBusy || newPassword.length < 10} className="btn-secondary">
            {pwBusy && <Loader2 size={16} className="animate-spin" aria-hidden />} {t("prof.changePassword")}
          </button>
          <Message msg={pwMsg} />
        </div>
      </form>
    </div>
  );
}

function Field({ id, label, value, onChange, ...rest }: { id: string; label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id">) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.kind === "error" ? "alert" : "status"} className={`mt-2 text-sm ${msg.kind === "error" ? "text-danger" : "text-success"}`}>
      {msg.text}
    </p>
  );
}
