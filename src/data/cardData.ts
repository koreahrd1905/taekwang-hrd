export interface Question {
  id: number;
  question: string;
  description: string;
}

export interface TaskCardType {
  id: number;          // 1 ~ 5
  typeCode: string;    // "1형", "2형", "3형", "4형", "5형"
  title: string;       // "1형 [사업보국형]"
  category: string;    // "사업보국 & 직업적 사명감"
  summary: string;
  themeColor: string;  // For accent colors in UI
  questions: Question[];
}

export interface Submission {
  id: string;
  name: string;
  department: string;
  phone?: string;      // 휴대전화 번호 (예: 010-1234-5678)
  email?: string;      // 이메일 주소
  cardType?: string;   // "1형 [사업보국형]"
  questions: Question[];
  answers: Record<number, string>;
  fileName: string;
  submittedAt: string; // YYYY-MM-DD HH:MM:SS
}

export const taskCardTypes: TaskCardType[] = [
  {
    id: 1,
    typeCode: "1형",
    title: "1형 [사업보국형]",
    category: "사업보국 & 직업적 사명감",
    summary: "나의 직무가 사회와 경제에 미치는 긍정적 영향과 책임의식을 성찰합니다.",
    themeColor: "#C5A059", // Gold
    questions: [
      {
        id: 101,
        question: "태광그룹 창업주의 '사업보국(기업을 세워 국가와 사회에 기여한다)' 정신을 읽으며, 내가 현재 담당하고 있는 직무가 회사와 사회에 미치는 가치와 긍정적 영향은 무엇이라고 생각하시나요?",
        description: "현재 수행 중인 직무의 의미를 사회적·경제적 기여도 관점에서 넓게 바라보고 작성해 주세요."
      },
      {
        id: 102,
        question: "창업주의 숭고한 사명감을 본받아, 나의 업무 몰입도와 책임감을 한 단계 높이기 위해 이번 주에 실천할 수 있는 구체적인 행동 1가지를 적어주세요.",
        description: "실제 내 업무 환경에서 실행 가능한 주도적이고 책임감 있는 실천 약속을 서술해 주세요."
      }
    ]
  },
  {
    id: 2,
    typeCode: "2형",
    title: "2형 [인재제일형]",
    category: "인재제일 & 상호신뢰·소통",
    summary: "동료와의 신뢰 및 시너지 창출을 위한 실천 방안과 협업 가치를 조명합니다.",
    themeColor: "#4F46E5", // Indigo/Royal Blue
    questions: [
      {
        id: 201,
        question: "'사람이 곧 기업의 전부이며, 인재를 믿고 맡긴다'는 창업주의 인재제일 철학에 비추어 볼 때, 동료 및 팀원들과 일하며 상호 신뢰와 협업의 중요성을 체감했던 경험이나 깨달음은 무엇인가요?",
        description: "프로젝트 진행이나 일상 업무 과정에서 팀워크와 배려를 통해 좋은 시너지를 얻었던 실제 경험을 적어주세요."
      },
      {
        id: 202,
        question: "건강하고 긍정적인 조직 문화를 위해, 내가 먼저 동료나 팀원에게 건넬 수 있는 따뜻한 소통이나 협업 실천 방안 1가지는 무엇인가요?",
        description: "감사 표현, 경청 태도 개선, 먼저 돕기 등 사소하지만 긍정적인 변화를 일으킬 실천 방안을 제시해 주세요."
      }
    ]
  },
  {
    id: 3,
    typeCode: "3형",
    title: "3형 [도전경영형]",
    category: "도전경영 & 혁신실행",
    summary: "한계 극복 경험과 업무 개선을 위한 작지만 혁신적인 아이디어를 고민합니다.",
    themeColor: "#EF4444", // Red/Crimson
    questions: [
      {
        id: 301,
        question: "'해보지 않고서는 결코 불가능을 말하지 말라'는 창업주의 도전 정신을 접하며, 최근 업무나 개인적 목표에서 마주했던 장애물이나 한계를 극복하고자 노력했던 순간은 언제였나요?",
        description: "포기하지 않고 해결책을 찾기 위해 도전했던 노력과 그에 따른 성장을 담아 주세요."
      },
      {
        id: 302,
        question: "관행이나 익숙함에 안주하지 않고, 내 업무 방식을 조금 더 새롭고 효율적으로 개선하기 위해 시도해보고 싶은 '작은 도전(아이디어)' 1가지는 무엇인가요?",
        description: "업무 프로세스 단축, 매뉴얼 개선 등 크지 않더라도 실행하면 도움이 될 혁신 아이디어를 제안해 주세요."
      }
    ]
  },
  {
    id: 4,
    typeCode: "4형",
    title: "4형 [정직신용형]",
    category: "정직과 신용 & 정도경영",
    summary: "원칙 준수의 중요성과 비즈니스 파트너십 내에서의 나만의 신용 수칙을 수립합니다.",
    themeColor: "#10B981", // Emerald Green
    questions: [
      {
        id: 401,
        question: "'정직으로 쌓은 신용은 불황기에도 기업을 지탱하는 가장 단단한 무기'라는 창업주의 가르침과 관련하여, 직장 생활에서 원칙과 신뢰를 지키는 것이 왜 가장 중요한지 본인의 생각을 들려주세요.",
        description: "단기적인 이익보다 장기적인 신뢰가 기업과 개인 모두에게 주는 핵심 가치를 적어주세요."
      },
      {
        id: 402,
        question: "고객, 협력사, 혹은 사내 동료와의 신뢰 관계를 더욱 두텁게 만들기 위해 내가 지키고자 하는 '나만의 정직·신용 행동 수칙' 1가지는 무엇인가요?",
        description: "기한 준수, 투명한 보고, 약속 이행 등 스스로 철저히 지키고자 다짐하는 수칙을 작성해 주세요."
      }
    ]
  },
  {
    id: 5,
    typeCode: "5형",
    title: "5형 [상생나눔형]",
    category: "사회공헌 & 백년기업",
    summary: "지속 가능한 성장을 위한 기업의 역할과 상생 배려 문화를 논합니다.",
    themeColor: "#F59E0B", // Amber Gold
    questions: [
      {
        id: 501,
        question: "장학 재단 설립 및 나눔을 통해 백년기업의 기틀을 마련한 창업주의 상생 철학을 보며, 기업과 개인이 사회공동체와 함께 지속 가능한 미래를 만들어가기 위해 갖추어야 할 태도는 무엇이라고 생각하시나요?",
        description: "동반 성장, 사회적 가치 기여, ESG 등 공생 관계 형성을 위해 임직원으로서 취해야 할 시각을 제시해 주세요."
      },
      {
        id: 502,
        question: "나와 우리 부서의 일상에서 '상생과 배려, 긍정적 영향력'을 확산시키기 위해 지금 당장 실천할 수 있는 작은 나눔이나 친환경/사회적 가치 활동 1가지는 무엇인가요?",
        description: "부서 내 협력사 배려, 친환경 일회용품 줄이기, 사내 매너 등 오늘부터 즉시 실행 가능한 행동을 서술해 주세요."
      }
    ]
  }
];
