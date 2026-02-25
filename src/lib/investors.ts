/**
 * 投资大佬信息配置
 * 包括个人介绍、投资风格、持仓比例等详细信息
 */

export interface Investor {
  name: string;
  type: 'individual' | 'institution';
  description: string; // 个人介绍
  investmentStyle: string; // 投资风格类型
  holdingRatio?: string; // 大致持仓比例说明
  avatar?: string; // 头像图标（可选）
}

export const INVESTORS: Investor[] = [
  {
    name: '沃伦·巴菲特',
    type: 'individual',
    description: '伯克希尔·哈撒韦公司CEO，被誉为"股神"，价值投资的代表人物。2024年福布斯全球富豪榜排名第10位，净资产约1180亿美元。',
    investmentStyle: '价值投资 · 长期持有 · 优质企业',
    holdingRatio: '集中持仓，重仓前5大公司占比约70-80%',
  },
  {
    name: '段永平',
    type: 'individual',
    description: '步步高创始人，著名投资人。以投资苹果、茅台等知名企业而闻名，被誉为"中国巴菲特"。擅长在低谷期买入优质企业。',
    investmentStyle: '价值投资 · 品牌护城河 · 长期耐心',
    holdingRatio: '极度集中，重仓股票占比超过80%',
  },
  {
    name: '李录',
    type: 'individual',
    description: '喜马拉雅资本创始人，芒格家族基金管理人。深度价值投资者，专注于中国和美国的优秀企业。是芒格的亲密伙伴和思想传承者。',
    investmentStyle: '深度价值 · 宏观视野 · 跨境投资',
    holdingRatio: '高度集中，前3大持仓占比约60-70%',
  },
  {
    name: '但斌',
    type: 'individual',
    description: '东方港湾投资董事长，中国最知名的价值投资践行者之一。长期看好中国优质企业，以重仓茅台、腾讯等企业著称。',
    investmentStyle: '价值投资 · 优质白马 · 长期坚守',
    holdingRatio: '集中持仓，核心持仓占比约50-60%',
  },
  {
    name: '詹姆斯·西蒙斯',
    type: 'individual',
    description: '文艺复兴科技创始人，量化投资之父。数学家出身，创立了量化交易的传奇。旗下大奖章基金年化收益率超过66%。',
    investmentStyle: '量化投资 · 数学模型 · 短线交易',
    holdingRatio: '分散持仓，持有数百只股票，单一持仓占比低于2%',
  },
  {
    name: '红杉资本',
    type: 'institution',
    description: '全球顶级风险投资机构，成立于1972年。成功投资了苹果、谷歌、WhatsApp等科技巨头。中国业务由沈南鹏领导，是A股和港股的重要投资者。',
    investmentStyle: '风险投资 · 科技创新 · 早期布局',
    holdingRatio: '广泛分散，投资组合包含数百家公司',
  },
  {
    name: '贝莱德',
    type: 'institution',
    description: '全球最大的资产管理公司，管理资产超过10万亿美元。通过iShares ETF产品成为全球最大被动投资机构，对全球股市有巨大影响力。',
    investmentStyle: '指数投资 · ESG · 长期配置',
    holdingRatio: '高度分散，跟踪全球指数，单一持仓占比低于5%',
  },
  {
    name: '桥水基金',
    type: 'institution',
    description: '全球最大的对冲基金，由雷·达里奥创立。以"全天候"投资策略和宏观经济分析著称，专注于风险平价和宏观对冲策略。',
    investmentStyle: '宏观对冲 · 风险平价 · 全球配置',
    holdingRatio: '全球分散，投资范围涵盖债券、股票、商品等多类资产',
  },
  {
    name: '高瓴资本',
    type: 'institution',
    description: '亚洲最大的私募股权基金之一，由张磊创立。擅长长期价值投资和产业整合，投资了腾讯、京东、美团等中国科技巨头。',
    investmentStyle: '价值投资 · 产业赋能 · 长期陪伴',
    holdingRatio: '中等集中，前10大持仓占比约40-50%',
  },
  {
    name: '索罗斯基金',
    type: 'institution',
    description: '由乔治·索罗斯创立的著名对冲基金。以"反身性理论"和宏观投资著称，曾成功预测并做空英镑而闻名。',
    investmentStyle: '宏观投机 · 反身性理论 · 事件驱动',
    holdingRatio: '中等集中，根据宏观机会灵活调整',
  },
];

// 获取投资者信息
export function getInvestorInfo(name: string): Investor | undefined {
  return INVESTORS.find(investor => investor.name === name);
}

// 获取所有个人投资者
export function getIndividualInvestors(): Investor[] {
  return INVESTORS.filter(investor => investor.type === 'individual');
}

// 获取所有机构投资者
export function getInstitutionInvestors(): Investor[] {
  return INVESTORS.filter(investor => investor.type === 'institution');
}
