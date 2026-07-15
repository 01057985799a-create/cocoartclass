"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AcademyAccessProvider, type AcademyRole } from "./AcademyAccess";

type Mode="login"|"teacherSignup"|"academySignup"|"forgot"|"recovery";
type Member={display_name:string;role:AcademyRole;active:boolean;approval_status?:string;academy_id?:string|null;academies?:{active:boolean}|{active:boolean}[]|null};

export default function AuthGate({children}:{children:React.ReactNode}){
  const [session,setSession]=useState<Session|null>(null);
  const [member,setMember]=useState<Member|null>(null);
  const [checking,setChecking]=useState(true);
  const [mode,setMode]=useState<Mode>("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [academyName,setAcademyName]=useState("");
  const [academyCode,setAcademyCode]=useState("");
  const [businessNumber,setBusinessNumber]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [submitting,setSubmitting]=useState(false);

  useEffect(()=>{let mounted=true;const resolve=async(next:Session|null,event?:string)=>{if(!mounted)return;setSession(next);if(event==="PASSWORD_RECOVERY"){setMode("recovery");setChecking(false);return}if(!next){setMember(null);setChecking(false);return}const {data,error:memberError}=await supabase.from("academy_users").select("display_name,role,active,approval_status,academy_id,academies(active)").eq("user_id",next.user.id).single();if(!mounted)return;const academyInfo=Array.isArray(data?.academies)?data.academies[0]:data?.academies;const academySuspended=data?.role!=="super_admin"&&academyInfo?.active===false;if(memberError||!data?.active||academySuspended){const status=data?.approval_status;setError(academySuspended?"학원 이용이 중지되었습니다. 사이트 관리자에게 문의해 주세요.":status==="rejected"?"가입 신청이 승인되지 않았습니다. 원장님께 문의해 주세요.":"원장님의 승인을 기다리고 있는 계정입니다.");setMember(null);await supabase.auth.signOut()}else setMember(data as Member);setChecking(false)};void supabase.auth.getSession().then(({data})=>resolve(data.session));const {data:listener}=supabase.auth.onAuthStateChange((event,next)=>{setChecking(true);void resolve(next,event)});return()=>{mounted=false;listener.subscription.unsubscribe()}},[]);

  const submit=async(event:FormEvent)=>{event.preventDefault();setSubmitting(true);setError("");setNotice("");
    if(mode==="teacherSignup"||mode==="academySignup"){
      const owner=mode==="academySignup";
      const {error:signupError}=await supabase.auth.signUp({email:email.trim(),password,options:{data:owner?{account_type:"academy_owner",name:name.trim(),academy_name:academyName.trim(),business_number:businessNumber.trim()}:{account_type:"teacher",name:name.trim(),academy_code:academyCode.trim().toUpperCase()},emailRedirectTo:window.location.origin}});
      if(signupError)setError(signupError.message.includes("invalid academy code")?"학원 코드를 확인해 주세요.":signupError.message);
      else{setNotice(owner?"학원 가입이 완료되었습니다. 이메일 인증 후 원장 계정으로 로그인하세요.":"강사 가입 신청을 보냈습니다. 이메일 인증 후 원장 승인을 기다려 주세요.");setMode("login")}
    }else if(mode==="forgot"){
      const {error:resetError}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});
      if(resetError)setError(resetError.message.toLowerCase().includes("rate limit")?"이메일 요청이 잠시 제한됐습니다. 잠시 후 다시 시도해 주세요.":"재설정 메일을 보내지 못했습니다.");else{setNotice("비밀번호 재설정 메일을 보냈습니다.");setMode("login")}
    }else if(mode==="recovery"){
      const {error:updateError}=await supabase.auth.updateUser({password});if(updateError)setError(updateError.message);else{setNotice("새 비밀번호로 변경했습니다.");setMode("login");await supabase.auth.signOut()}
    }else{
      const {error:loginError}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(loginError)setError(loginError.message.toLowerCase().includes("email not confirmed")?"가입한 이메일에서 인증 링크를 먼저 눌러 주세요.":"이메일 또는 비밀번호를 확인해 주세요.")
    }
    setSubmitting(false);
  };

  const backToLogin=()=>{setMode("login");setError("");setNotice("")};
  if(checking)return <div className="flex min-h-screen items-center justify-center bg-[#f8f3ea] text-sm font-semibold text-[#52796f]">로그인과 권한을 확인하는 중...</div>;
  if(session&&member)return <AcademyAccessProvider value={{role:member.role,displayName:member.display_name,academyId:member.academy_id}}>{children}</AcademyAccessProvider>;

  const title=mode==="teacherSignup"?"강사 가입 신청":mode==="academySignup"?"학원 원장 가입":mode==="forgot"?"비밀번호 찾기":mode==="recovery"?"새 비밀번호 설정":"미술학원 AI";
  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f8f3ea] via-white to-[#f8d9d1] px-5 py-12"><div className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-xl ring-1 ring-[#eadfd6] sm:p-9"><div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f8d0c6] text-3xl">🎨</div><p className="mt-5 text-sm font-bold tracking-wider text-[#52796f]">ART ACADEMY PLATFORM</p><h1 className="mt-1 text-2xl font-black text-[#283c37]">{title}</h1><p className="mt-2 text-sm text-zinc-500">{mode==="academySignup"?"새 학원을 등록하고 원장 계정을 만듭니다.":mode==="teacherSignup"?"원장님에게 받은 학원 코드가 필요합니다.":mode==="forgot"?"가입한 이메일로 변경 링크를 보내드립니다.":mode==="recovery"?"앞으로 사용할 비밀번호를 입력하세요.":"원장·강사 전용 통합 관리 화면입니다."}</p></div>
    <form onSubmit={submit} className="mt-7 grid gap-4">
      {(mode==="teacherSignup"||mode==="academySignup")&&<label className="grid gap-1.5 text-sm font-semibold">{mode==="academySignup"?"원장 이름":"강사 이름"}<input required value={name} onChange={e=>setName(e.target.value)} className="rounded-xl border border-[#dfd5cc] px-4 py-3.5 font-normal outline-none focus:border-[#ee806c]" /></label>}
      {mode==="academySignup"&&<><label className="grid gap-1.5 text-sm font-semibold">학원 이름<input required value={academyName} onChange={e=>setAcademyName(e.target.value)} placeholder="예: 언제나미술학원" className="rounded-xl border border-[#dfd5cc] px-4 py-3.5 font-normal outline-none focus:border-[#ee806c]" /></label><label className="grid gap-1.5 text-sm font-semibold">사업자번호 <span className="font-normal text-zinc-400">선택</span><input value={businessNumber} onChange={e=>setBusinessNumber(e.target.value)} className="rounded-xl border border-[#dfd5cc] px-4 py-3.5 font-normal outline-none focus:border-[#ee806c]" /></label></>}
      {mode==="teacherSignup"&&<label className="grid gap-1.5 text-sm font-semibold">학원 코드<input required value={academyCode} onChange={e=>setAcademyCode(e.target.value)} placeholder="원장님에게 받은 코드" className="rounded-xl border border-[#dfd5cc] px-4 py-3.5 uppercase font-normal outline-none focus:border-[#ee806c]" /></label>}
      {mode!=="recovery"&&<label className="grid gap-1.5 text-sm font-semibold">이메일<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="rounded-xl border border-[#dfd5cc] px-4 py-3.5 font-normal outline-none focus:border-[#ee806c]" /></label>}
      {mode!=="forgot"&&<label className="grid gap-1.5 text-sm font-semibold">{mode==="recovery"?"새 비밀번호":"비밀번호"}<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} className="rounded-xl border border-[#dfd5cc] px-4 py-3.5 font-normal outline-none focus:border-[#ee806c]" /></label>}
      {error&&<p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}{notice&&<p className="rounded-xl bg-[#edf5f1] px-3 py-2.5 text-sm text-[#3f655d]">{notice}</p>}
      <button disabled={submitting} className="rounded-xl bg-[#52796f] py-4 font-bold text-white disabled:opacity-50">{submitting?"처리 중...":mode==="teacherSignup"?"강사 가입 신청":mode==="academySignup"?"학원 가입하기":mode==="forgot"?"재설정 메일 보내기":mode==="recovery"?"비밀번호 변경":"로그인"}</button>
    </form>
    {mode==="login"?<div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>setMode("academySignup")} className="rounded-xl bg-[#fce8e3] px-3 py-3 text-sm font-bold text-[#b95845]">학원 원장 가입</button><button onClick={()=>setMode("teacherSignup")} className="rounded-xl bg-[#e7f0ec] px-3 py-3 text-sm font-bold text-[#3f655d]">강사 가입 신청</button><button onClick={()=>setMode("forgot")} className="col-span-2 mt-1 text-sm font-semibold text-zinc-500">비밀번호를 잊으셨나요?</button></div>:mode!=="recovery"&&<button onClick={backToLogin} className="mt-5 w-full text-sm font-bold text-[#52796f]">로그인으로 돌아가기</button>}
  </div></main>;
}
