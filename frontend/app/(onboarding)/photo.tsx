import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { OnboardingScreen, onboardingStyles as s } from "@/components/onboarding/screen";
import { useOnboarding } from "@/context/onboarding-context";
import { useAuth } from "@/context/auth-context";
import { completeOnboarding, uploadMyAvatar } from "@/lib/follows";
export default function PhotoStep(){ "use no memo"; const {draft,update,clear}=useOnboarding(); const {session}=useAuth(); const qc=useQueryClient(); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const choose=async(camera:boolean)=>{const p=camera?await ImagePicker.requestCameraPermissionsAsync():await ImagePicker.requestMediaLibraryPermissionsAsync();if(!p.granted)return Alert.alert("Permission needed","Allow access to add your photo.");const r=camera?await ImagePicker.launchCameraAsync({allowsEditing:true,aspect:[1,1],quality:.85}):await ImagePicker.launchImageLibraryAsync({allowsEditing:true,aspect:[1,1],quality:.85});const a=!r.canceled?r.assets?.[0]:undefined;if(a?.uri)update({photoUri:a.uri,photoRemoteUrl:""});}; const finish = async () => {
    const token = session?.access_token;
    if (!token) {
      return setError("Unable to complete onboarding. Please sign in again.");
    }
    if (!draft.photoUri && !draft.photoRemoteUrl) {
      return setError("Add a profile photo.");
    }

    setSaving(true);
    try {
      let avatar = draft.photoRemoteUrl;
      if (draft.photoUri) {
        const r = await uploadMyAvatar(token, {
          uri: draft.photoUri,
          name: "avatar.jpg",
          type: "image/jpeg",
        });
        avatar = r.profile?.avatar_url ?? avatar ?? "";
      }

      const result = await completeOnboarding(token, {
        full_name: draft.fullName.trim(),
        username: draft.username.trim(),
        avatar_url: avatar,
        location_city: draft.city.trim(),
        location_region: draft.region.trim(),
        app_goals: draft.goals,
        produce_interests: draft.produce,
      });

      if (result.profile) {
        qc.setQueryData(["me", session.user.id], result.profile);
      }
      await qc.invalidateQueries({
        queryKey: ["me", session.user.id],
        refetchType: "active",
      });
      await clear();
      router.replace("/(tabs)");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Please try again";
      if (m.toLowerCase().includes("username")) {
        Alert.alert("Username unavailable", m);
        router.replace("/(onboarding)/profile" as never);
      } else {
        setError(m);
      }
    } finally {
      setSaving(false);
    }
  };const photo=draft.photoUri||draft.photoRemoteUrl;return <OnboardingScreen step={5} title="Add a profile photo" subtitle="Help local farms and neighbors recognize you." back={() => router.replace("/(onboarding)/interests" as never)} next={finish} nextLabel={saving?"Saving…":"Finish"} disabled={saving} error={error}><View style={s.photo}>{photo?<Image source={{uri:photo}} style={s.image}/>:<Text>Add photo</Text>}</View><Button variant="outline" onPress={()=>choose(false)}>Choose from library</Button><Button variant="outline" onPress={()=>choose(true)}>Take a photo</Button></OnboardingScreen>;}
