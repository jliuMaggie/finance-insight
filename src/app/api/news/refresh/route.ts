import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST() {
  try {
    // 重新验证新闻页面缓存
    revalidatePath('/');
    revalidatePath('/api/news');
    
    return NextResponse.json({
      success: true,
      message: 'News cache invalidated',
    });
  } catch (error) {
    console.error('Error refreshing news cache:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh news cache',
      },
      { status: 500 }
    );
  }
}
