import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
const mockPush=jest.fn(), mockBack=jest.fn(), mockOrder=jest.fn(), mockUser=jest.fn(), mockSigned=jest.fn();
jest.mock("expo-router",()=>{const React=require("react");const {View}=require("react-native");return{Stack:{Screen:()=> <View/>},router:{push:(...a:any[])=>mockPush(...a),back:(...a:any[])=>mockBack(...a)},useFocusEffect:(cb:any)=>React.useEffect(cb,[cb])}});
jest.mock("react-native-safe-area-context",()=>({SafeAreaView:({children}:any)=>children}));
jest.mock("@expo/vector-icons",()=>{const React=require("react");const {View}=require("react-native");const Icon=(p:any)=><View {...p}/>;Icon.glyphMap={};return{Ionicons:Icon}});
jest.mock("@/hooks/useTheme",()=>({useTheme:()=>({colors:{background:"white",card:"#eee",border:{light:"gray",default:"gray"},text:{primary:"black",secondary:"gray",tertiary:"gray"},input:{background:"#eee",placeholder:"gray",text:"black"}}})}));
jest.mock("@/lib/supabase",()=>({supabase:{auth:{getUser:(...a:any[])=>mockUser(...a)},from:()=>({select:()=>({eq:()=>({order:(...a:any[])=>mockOrder(...a)})})}),storage:{from:()=>({createSignedUrl:(...a:any[])=>mockSigned(...a)})}}}));
import MyRecipesScreen from "@/app/recipe/my-recipes";
const base={user_id:"u",description:null,cover_image_url:null,cover_image_path:null,cover_media:null,prep_time_minutes:0,cook_time_minutes:0,additional_time_minutes:0,total_time_minutes:0,servings:null,ingredients:[],steps:[],difficulty:"Easy",created_at:"2026-01-01",updated_at:"2026-01-01"};
const data=[
 {...base,id:"r1",title:"Pancakes",description:"Fluffy",tags:["Breakfast","Sweet"],total_time_minutes:25,servings:2,ingredients:[{name:"Flour"}],steps:[{instruction:"Mix"}],cover_image_path:"one.jpg"},
 {...base,id:"r2",title:"Salad",tags:["Lunch"],difficulty:"Medium",total_time_minutes:60,cover_image_url:"direct.jpg"},
 {...base,id:"r3",title:"Stew",tags:["Dinner"],difficulty:"Hard",total_time_minutes:75},
 {...base,id:"r4",title:"Snack",tags:["Quick"],cover_media:[{path:"media.jpg"}],steps:[{photo_paths:["step.jpg"],photo_urls:[]}]},
];
describe("my recipes",()=>{
 beforeEach(()=>{jest.clearAllMocks();mockUser.mockResolvedValue({data:{user:{id:"u"}},error:null});mockOrder.mockResolvedValue({data,error:null});mockSigned.mockImplementation(async(p:string)=>({data:{signedUrl:`signed:${p}`},error:null}))});
 it("groups, filters, searches, and navigates owned recipes",async()=>{const s=await render(<MyRecipesScreen/>);await waitFor(()=>expect(s.getAllByText("Pancakes").length).toBeGreaterThan(0));expect(s.getByText("4 saved recipes across breakfast, lunch, and dinner.")).toBeTruthy();expect(mockSigned).toHaveBeenCalled();
  await fireEvent.press(s.getAllByText("Breakfast")[0]);expect(s.getAllByText("Pancakes").length).toBeGreaterThan(0);expect(s.queryByText("Stew")).toBeNull();await fireEvent.press(s.getAllByText("Breakfast")[0]);
  await fireEvent.changeText(s.getByPlaceholderText("Search recipes, tags, ingredients, or steps"),"missing");await waitFor(()=>expect(s.getByText("No recipes found")).toBeTruthy());await fireEvent.press(s.getByLabelText("Clear search"));await waitFor(()=>expect(s.getAllByText("Pancakes").length).toBeGreaterThan(0));
  await fireEvent.press(s.getAllByText("Pancakes")[0]);expect(mockPush).toHaveBeenCalledWith("/recipe/r1");await fireEvent.press(s.getByText("New Recipe"));expect(mockPush).toHaveBeenCalledWith("/recipe/new");await fireEvent.press(s.getByLabelText("Go back"));expect(mockBack).toHaveBeenCalled();});
 it("handles a signed-out user",async()=>{mockUser.mockResolvedValue({data:{user:null},error:null});const s=await render(<MyRecipesScreen/>);await waitFor(()=>expect(s.getByText("You need to be signed in to view your recipes.")).toBeTruthy());});
 it("handles an empty collection and opens creation",async()=>{mockOrder.mockResolvedValue({data:[],error:null});const s=await render(<MyRecipesScreen/>);await waitFor(()=>expect(s.getByText("No saved recipes yet")).toBeTruthy());await fireEvent.press(s.getByText("Create recipe"));expect(mockPush).toHaveBeenCalledWith("/recipe/new");});
 it("reports auth failures and retries",async()=>{mockUser.mockResolvedValue({data:{user:null},error:new Error("auth failed")});const s=await render(<MyRecipesScreen/>);await waitFor(()=>expect(s.getByText("auth failed")).toBeTruthy());mockUser.mockResolvedValue({data:{user:{id:"u"}},error:null});mockOrder.mockResolvedValue({data:[],error:null});await fireEvent.press(s.getByText("Try again"));await waitFor(()=>expect(s.getByText("No saved recipes yet")).toBeTruthy());});
 it("uses fallback URLs when signing fails",async()=>{mockSigned.mockResolvedValue({data:null,error:{message:"expired"}});const s=await render(<MyRecipesScreen/>);await waitFor(()=>expect(s.getAllByText("Pancakes").length).toBeGreaterThan(0));expect(mockSigned).toHaveBeenCalled();});
});
