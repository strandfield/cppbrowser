
import { reactive } from 'vue'
import $ from "jquery"

let session_data = {
    permissions: {
        uploadSnapshot: false,
        deleteSnapshot: false,
        hasCheckedPermissions: false,
        checkingPermissions: false
    }
};

export const session = reactive(session_data);

function handleResult(data) {
    session.permissions.hasCheckedPermissions = true;
    session.permissions.checkingPermissions = false;

    session.permissions.uploadSnapshot = data.permissions.uploadSnapshot;
    session.permissions.deleteSnapshot = data.permissions.deleteSnapshot;
}

export function checkPermissions() {
    if (session_data.permissions.hasCheckedPermissions || session_data.permissions.checkingPermissions) {
        return;
    }

    session_data.permissions.checkingPermissions = true;
    $.get(`api/site/info`, handleResult);
}
