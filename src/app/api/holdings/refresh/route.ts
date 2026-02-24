import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST() {
  try {
    // 重新验证持仓页面缓存
    revalidatePath('/');
    revalidatePath('/api/holdings');
    
    return NextResponse.json({
      success: true,
      message: 'Holdings cache invalidated',
    });
  } catch (error) {
    console.error('Error refreshing holdings cache:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh holdings cache',
      },
      { status: 500 }
    );
  }
}
