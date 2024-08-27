//deprecated and not used for now
//can handle connections between frontend and main.py
export const uploadImage = async (files: File[]) => {

    const formData = new FormData();
    formData.append('file', files[0]);
    const projectId = newProject.value.projectData.project_id || '123';

    const response = await HTTP.post(`/uploadfile/?project_id=${projectId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    })

    //take the last part of the path
    const filename = response.data.filename.split("/").pop();
    customization.value.logo = filename
    imagePath.value = projectId + "/" + filename;
    console.log(response.data)
}