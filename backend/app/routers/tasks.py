from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import schemas, models
from app.oauth2 import get_current_user, get_current_admin_user

router = APIRouter(
    prefix="/api/v1",
    tags=['Tasks']
)

# User Routes for Tasks
@router.get("/tasks", response_model=List[schemas.TaskOut])
def get_tasks(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    tasks = db.query(models.Task).filter(models.Task.owner_id == current_user.id).all()
    return tasks

@router.post("/tasks", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    new_task = models.Task(title=task.title, description=task.description, status=task.status, owner_id=current_user.id)
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@router.put("/tasks/{id}", response_model=schemas.TaskOut)
def update_task(id: int, task: schemas.TaskUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    task_query = db.query(models.Task).filter(models.Task.id == id, models.Task.owner_id == current_user.id)
    existing_task = task_query.first()
    
    if not existing_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task with id: {id} does not exist or you are not the owner")
    
    update_data = task.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(existing_task, key, value)
        
    db.commit()
    db.refresh(existing_task)
    return existing_task

@router.delete("/tasks/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    task_query = db.query(models.Task).filter(models.Task.id == id, models.Task.owner_id == current_user.id)
    task = task_query.first()
    
    if task == None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task with id: {id} does not exist or you are not the owner")
        
    task_query.delete(synchronize_session=False)
    db.commit()
    return

# Admin Route
@router.get("/admin/tasks", response_model=List[schemas.TaskOut])
def get_all_tasks_admin(db: Session = Depends(get_db), current_admin: models.User = Depends(get_current_admin_user)):
    tasks = db.query(models.Task).all()
    return tasks
