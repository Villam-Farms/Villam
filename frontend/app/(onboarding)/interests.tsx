import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { OnboardingScreen, onboardingStyles as s } from "@/components/onboarding/screen";
import { useOnboarding } from "@/context/onboarding-context";
const OPTIONS = [["vegetables","Vegetables"],["fruits","Fruits"],["herbs","Herbs"],["flowers","Flowers"],["eggs_dairy","Eggs and dairy"],["pantry_goods","Pantry goods"]] as const;
export default function InterestsStep() { "use no memo"; const { draft, update }=useOnboarding(); const [error,setError]=useState(""); const toggle=(v:string)=>update({produce:draft.produce.includes(v)?draft.produce.filter(x=>x!==v):[...draft.produce,v]}); const next=()=>{if(!draft.produce.length)return setError("Select at least one interest.");router.replace("/(onboarding)/photo" as never);}; return <OnboardingScreen step={4} title="What are you interested in?" subtitle="We’ll use this to improve recommendations." back="/(onboarding)/goals" next={next} nextHref={draft.produce.length ? "/(onboarding)/photo" : undefined} error={error}><View style={s.choices}>{OPTIONS.map(([v,l])=><Pressable key={v} onPress={()=>toggle(v)} style={[s.choice,draft.produce.includes(v)&&s.choiceActive]}><Text style={s.choiceText}>{l}</Text></Pressable>)}</View></OnboardingScreen>; }
