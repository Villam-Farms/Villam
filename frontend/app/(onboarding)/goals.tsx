import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { OnboardingScreen, onboardingStyles as s } from "@/components/onboarding/screen";
import { useOnboarding } from "@/context/onboarding-context";
const OPTIONS = [["discover_farms","Discover nearby farms"],["shop_seasonal","Shop seasonal produce"],["plan_grocery_lists","Plan grocery lists"],["find_recipes","Find recipes"],["support_local","Support local agriculture"]] as const;
export default function GoalsStep() { "use no memo"; const { draft, update } = useOnboarding(); const [error,setError]=useState(""); const toggle=(v:string)=>update({goals:draft.goals.includes(v)?draft.goals.filter(x=>x!==v):[...draft.goals,v]}); const next=()=>{if(!draft.goals.length)return setError("Select at least one goal.");router.replace("/(onboarding)/interests" as never);}; return <OnboardingScreen step={3} title="What brings you to Villam?" subtitle="Choose all that apply." back={() => router.replace("/(onboarding)/location" as never)} next={next} error={error}><View style={s.choices}>{OPTIONS.map(([v,l])=><Pressable key={v} onPress={()=>toggle(v)} style={[s.choice,draft.goals.includes(v)&&s.choiceActive]}><Text style={s.choiceText}>{l}</Text></Pressable>)}</View></OnboardingScreen>; }
