import { apiClient } from '../client'

export type TaskStatus = 'pending' | 'awaiting_action' | 'done' | 'error'
export type TaskType = 'extract_from_image' | 'create_from_instagram_post'

export interface BackgroundTask {
  id: string
  type: TaskType
  status: TaskStatus
  input_summary: Record<string, unknown> | null
  result: Record<string, unknown> | null
  error: string | null
  created_at: string
  updated_at: string
}

export function listTasks(): Promise<BackgroundTask[]> {
  return apiClient.get<BackgroundTask[]>('tasks')
}

export function getTask(taskId: string): Promise<BackgroundTask> {
  return apiClient.get<BackgroundTask>(`tasks/${taskId}`)
}

export function completeTask(taskId: string): Promise<void> {
  return apiClient.patch(`tasks/${taskId}/complete`)
}

export function dismissTask(taskId: string): Promise<void> {
  return apiClient.patch(`tasks/${taskId}/dismiss`)
}
