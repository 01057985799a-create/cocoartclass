import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const anthropic=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY!});
const MODEL=process.env.ANTHROPIC_MODEL||"claude-opus-4-8";
const schema={type:"object",properties:{class_summary:{type:"string"},strengths:{type:"string"},next_focus:{type:"string"},parent_message:{type:"string"}},required:["class_summary","strengths","next_focus","parent_message"],additionalProperties:false};

function extractJson(text:string){const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i);if(fenced)return fenced[1].trim();const start=text.indexOf("{");const end=text.lastIndexOf("}");return start>=0&&end>start?text.slice(start,end+1):text}

export async function POST(request:Request){
  try{
    const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
    if(!token)return Response.json({error:"로그인이 필요합니다."},{status:401});
    const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const {data:{user}}=await supabase.auth.getUser(token);if(!user)return Response.json({error:"로그인이 만료되었습니다."},{status:401});
    const body=await request.json() as {studentName?:string;lessonTopic?:string;observations?:string;mood?:string;challenge?:string;nextPlan?:string};
    if(!body.studentName||!body.lessonTopic||!body.observations)return Response.json({error:"학생과 수업 내용을 입력해주세요."},{status:400});
    const message=await anthropic.messages.create({model:MODEL,max_tokens:1600,system:`당신은 한국 미술학원 선생님의 학생 피드백 작성을 돕는 보조 AI입니다. 관찰하지 않은 사실을 만들지 마세요. 아이를 평가하거나 낙인찍지 말고, 구체적 관찰과 성장 가능성을 따뜻하고 자연스러운 한국어로 작성하세요. parent_message는 학부모에게 바로 보낼 수 있는 4~6문장으로 작성하되 과장된 칭찬과 전문용어를 피하세요. Return only valid JSON with this JSON Schema: ${JSON.stringify(schema)}`,messages:[{role:"user",content:[{type:"text",text:[`학생: ${body.studentName}`,`수업 주제: ${body.lessonTopic}`,`선생님 관찰: ${body.observations}`,`수업 태도·기분: ${body.mood||"입력 없음"}`,`어려워한 점: ${body.challenge||"입력 없음"}`,`다음 수업 계획: ${body.nextPlan||"입력 없음"}`,"class_summary는 오늘 한 활동 요약, strengths는 관찰된 강점, next_focus는 다음 지도 방향으로 작성하세요."].join("\n")}]}]});
    const block=message.content.find(item=>item.type==="text");if(!block||block.type!=="text")throw new Error("No text response");
    return Response.json(JSON.parse(extractJson(block.text)));
  }catch(error){console.error("feedback generation failed",error);return Response.json({error:"피드백 생성 중 오류가 발생했습니다."},{status:500})}
}
